import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { resolveAgentsModulePath } from '../../../../shared/agents/paths.js';
import { collectAgentsFromWorkflows } from '../../../../shared/agents/workflow-discovery.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const CLI_BUNDLE_DIR = path.resolve(__dirname);
const CLI_PACKAGE_ROOT = (() => {
  let current = CLI_BUNDLE_DIR;
  const limit = 10;

  for (let i = 0; i < limit; i += 1) {
    const packageJson = path.join(current, 'package.json');
    if (existsSync(packageJson)) {
      try {
        const pkg = require(packageJson);
        if (pkg?.name === 'codemachine') {
          return current;
        }
      } catch {
        // Ignore parse/require errors and attempt the parent directory.
      }
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return undefined;
})();
const CLI_ROOT_CANDIDATES = Array.from(
  new Set([
    CLI_BUNDLE_DIR,
    CLI_PACKAGE_ROOT,
    CLI_PACKAGE_ROOT ? path.join(CLI_PACKAGE_ROOT, 'dist') : undefined
  ].filter((root): root is string => Boolean(root)))
);

const AGENT_MODULE_FILENAMES = ['main.agents.js', 'sub.agents.js', 'modules.js', 'agents.js'];

type AgentDefinition = {
  id: string;
  model?: unknown;
  modelReasoningEffort?: unknown;
  [key: string]: unknown;
};

const MODEL = 'gpt-5-codex';
const MODEL_REASONING_EFFORT = 'high';
const DEFAULT_MODEL_EFFORT = 'medium';
const VALID_MODEL_EFFORTS = new Set(['low', 'medium', 'high']);

function resolveProjectRoot(projectRoot?: string): string {
  if (projectRoot) {
    return projectRoot;
  }

  // Prefer the current working directory if it contains agent catalog modules so local overrides win
  const cwd = process.cwd();
  if (resolveAgentsModulePath({ projectRoot: cwd })) {
    return cwd;
  }

  // Fallback to the CLI install roots if no local config is present.
  for (const root of CLI_ROOT_CANDIDATES) {
    if (resolveAgentsModulePath({ projectRoot: root })) {
      return root;
    }
  }

  return CLI_ROOT_CANDIDATES[0];
}

function loadAgentsFromModule(modulePath: string): AgentDefinition[] {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch {
    // ignore cache miss
  }

  const loadedAgents = require(modulePath);
  return Array.isArray(loadedAgents) ? (loadedAgents as AgentDefinition[]) : [];
}

async function collectAgentDefinitions(projectRoot: string): Promise<AgentDefinition[]> {
  const candidates = new Set<string>();
  const roots = [projectRoot, ...CLI_ROOT_CANDIDATES.filter((root) => root && root !== projectRoot)];

  for (const root of roots) {
    if (!root) continue;
    const resolvedRoot = path.resolve(root);
    for (const filename of AGENT_MODULE_FILENAMES) {
      const moduleCandidate = path.join(resolvedRoot, 'config', filename);
      const distCandidate = path.join(resolvedRoot, 'dist', 'config', filename);

      if (existsSync(moduleCandidate)) {
        candidates.add(moduleCandidate);
      }
      if (existsSync(distCandidate)) {
        candidates.add(distCandidate);
      }
    }
  }

  const byId = new Map<string, AgentDefinition>();

  for (const modulePath of candidates) {
    const agents = loadAgentsFromModule(modulePath);
    for (const agent of agents) {
      if (!agent || typeof agent.id !== 'string') {
        continue;
      }
      const id = agent.id.trim();
      if (!id || byId.has(id)) {
        continue;
      }
      byId.set(id, { ...agent, id });
    }
  }

  const workflowAgents = await collectAgentsFromWorkflows(roots);
  for (const agent of workflowAgents) {
    if (!agent || typeof agent.id !== 'string') continue;
    const id = agent.id.trim();
    if (!id) continue;

    const existing = byId.get(id);
    if (existing) {
      byId.set(id, { ...existing, ...agent, id });
    } else {
      byId.set(id, { ...agent, id });
    }
  }

  return Array.from(byId.values());
}

function mergeAdditionalAgents(
  agents: AgentDefinition[],
  additionalAgents?: AgentDefinition[]
): AgentDefinition[] {
  if (!additionalAgents || additionalAgents.length === 0) {
    return agents;
  }

  const byId = new Map<string, AgentDefinition>();

  for (const agent of agents) {
    if (agent && typeof agent.id === 'string' && agent.id.trim()) {
      byId.set(agent.id, { ...agent });
    }
  }

  for (const candidate of additionalAgents) {
    if (!candidate || typeof candidate.id !== 'string') {
      continue;
    }
    const id = candidate.id.trim();
    if (!id) continue;
    const existing = byId.get(id) ?? {};
    byId.set(id, { ...existing, ...candidate, id });
  }

  return Array.from(byId.values());
}

async function resolveCodexHome(codexHome?: string): Promise<string> {
  const targetHome = codexHome ?? process.env.CODEX_HOME ?? path.join(homedir(), '.codemachine', 'codex');
  await mkdir(targetHome, { recursive: true });
  return targetHome;
}

function toTomlString(value: string): string {
  return JSON.stringify(value);
}

function resolveModel(agent: AgentDefinition): string {
  if (typeof agent.model === 'string' && agent.model.trim()) {
    return agent.model.trim();
  }

  return MODEL;
}

function resolveEffort(agent: AgentDefinition): 'low' | 'medium' | 'high' {
  const candidate =
    typeof agent.modelReasoningEffort === 'string'
      ? agent.modelReasoningEffort
      : typeof agent.model_reasoning_effort === 'string'
        ? agent.model_reasoning_effort
        : undefined;

  if (candidate) {
    const normalized = candidate.trim().toLowerCase();
    if (VALID_MODEL_EFFORTS.has(normalized)) {
      return normalized as 'low' | 'medium' | 'high';
    }
  }

  return DEFAULT_MODEL_EFFORT;
}

function buildConfigContent(agents: AgentDefinition[]): string {
  const lines = [
    '# Model configuration',
    `model = ${toTomlString(MODEL)}`,
    `model_reasoning_effort = ${toTomlString(MODEL_REASONING_EFFORT)}`
  ];

  const profileSections = agents
    .filter((agent): agent is AgentDefinition & { id: string } => typeof agent?.id === 'string')
    .map((agent) => {
      const effort = resolveEffort(agent);
      const model = resolveModel(agent);
      return [
        `[profiles.${agent.id}]`,
        `model = ${toTomlString(model)}`,
        `model_reasoning_effort = ${toTomlString(effort)}`
      ].join('\n');
    });

  if (profileSections.length > 0) {
    lines.push('', '# Profile configurations (dynamically generated from workflow templates and agent catalogs)');
    for (const section of profileSections) {
      lines.push('', section);
    }
  }

  return `${lines.join('\n')}\n`;
}

async function writeConfigIfChanged(configDir: string, content: string): Promise<void> {
  const configPath = path.join(configDir, 'config.toml');

  try {
    const existingContent = await readFile(configPath, 'utf8');
    if (existingContent === content) {
      return;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  await writeFile(configPath, content, 'utf8');
}

/**
 * Synchronises the Codex configuration file with the discovered agent definitions.
 */
export type ConfigSyncOptions = {
  projectRoot?: string;
  codexHome?: string;
  additionalAgents?: AgentDefinition[];
};

export async function syncCodexConfig(options?: ConfigSyncOptions): Promise<void> {
  const projectRoot = resolveProjectRoot(options?.projectRoot);
  const agents = mergeAdditionalAgents(await collectAgentDefinitions(projectRoot), options?.additionalAgents);
  const codexHome = await resolveCodexHome(options?.codexHome);
  const configContent = buildConfigContent(agents);

  await writeConfigIfChanged(codexHome, configContent);
}
