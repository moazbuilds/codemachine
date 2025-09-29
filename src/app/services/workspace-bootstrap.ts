import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectAgentsFromWorkflows } from '../../shared/agents/workflow-discovery.js';

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
        // fall through to climb one level higher
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
const AGENT_MODULE_FILENAMES = ['main.agents.js', 'sub.agents.js', 'agents.js'];
const SHOULD_DEBUG_BOOTSTRAP = process.env.CODEMACHINE_DEBUG_BOOTSTRAP === '1';

function debugLog(...args: unknown[]): void {
  if (SHOULD_DEBUG_BOOTSTRAP) {
    console.debug('[workspace-bootstrap]', ...args);
  }
}

type AgentDefinition = Record<string, unknown>;

export type WorkspaceBootstrapOptions = {
  projectRoot?: string;
  cwd?: string; // target working directory for this run
};

function resolveDesiredCwd(explicitCwd?: string): string {
  return explicitCwd ?? process.env.CODEMACHINE_CWD ?? process.cwd();
}

type LoadedAgent = AgentDefinition & { id: string; source?: 'main' | 'sub' | 'legacy' | 'workflow' };

async function loadAgents(candidateRoots: string[]): Promise<{ allAgents: AgentDefinition[]; subAgents: AgentDefinition[] }>
{
  const candidateModules = new Map<string, 'main' | 'sub' | 'legacy'>();

  for (const root of candidateRoots) {
    if (!root) continue;
    const resolvedRoot = path.resolve(root);
    for (const filename of AGENT_MODULE_FILENAMES) {
      const moduleCandidate = path.join(resolvedRoot, 'config', filename);
      const distCandidate = path.join(resolvedRoot, 'dist', 'config', filename);

      const tag = filename === 'main.agents.js' ? 'main' : filename === 'sub.agents.js' ? 'sub' : 'legacy';

      if (existsSync(moduleCandidate)) candidateModules.set(moduleCandidate, tag);
      if (existsSync(distCandidate)) candidateModules.set(distCandidate, tag);
    }
  }

  const byId = new Map<string, LoadedAgent>();

  for (const [modulePath, source] of candidateModules.entries()) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {
      // ignore cache miss
    }

    const loadedAgents = require(modulePath);
    const agents = Array.isArray(loadedAgents) ? (loadedAgents as AgentDefinition[]) : [];

    for (const agent of agents) {
      if (!agent || typeof agent.id !== 'string') {
        continue;
      }
      const id = agent.id.trim();
      if (!id) {
        continue;
      }
      const existing = byId.get(id);
      const sourceTag = existing?.source ?? source;
      const merged: LoadedAgent = {
        ...(existing ?? {}),
        ...agent,
        id,
        source: sourceTag,
      };
      byId.set(id, merged);
    }
  }

  const workflowAgents = await collectAgentsFromWorkflows(candidateRoots);
  for (const agent of workflowAgents) {
    if (!agent || typeof agent.id !== 'string') continue;
    const id = agent.id.trim();
    if (!id) continue;

    const existing = byId.get(id);
    const merged: LoadedAgent = {
      ...(existing ?? {}),
      ...agent,
      id,
      source: existing?.source ?? 'workflow',
    };
    byId.set(id, merged);
  }

  const allAgents = Array.from(byId.values()).map(({ source, ...agent }) => ({ ...agent }));
  const subAgents = Array.from(byId.values())
    .filter((agent) => agent.source === 'sub')
    .map(({ source, ...agent }) => ({ ...agent }));

  return { allAgents, subAgents };
}

async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

async function writeFileIfChanged(filePath: string, content: string): Promise<void> {
  try {
    const existing = await readFile(filePath, 'utf8');
    if (existing === content) return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await writeFile(filePath, content, 'utf8');
}

async function ensureSpecificationsTemplate(inputsDir: string): Promise<void> {
  const specPath = path.join(inputsDir, 'specifications.md');
  try {
    await readFile(specPath, 'utf8');
    return; // exists, do not overwrite
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const template = `# Project Specifications\n\n- Describe goals, constraints, and context.\n- Link any relevant docs or tickets.\n- This file is created by workspace bootstrap and can be safely edited.\n`;
  await writeFile(specPath, template, 'utf8');
}

function slugify(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function ensurePromptFile(filePath: string): Promise<void> {
  try {
    await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await writeFile(filePath, '', 'utf8');
  }
}

async function mirrorAgentsToJson(agentsDir: string, agents: AgentDefinition[]): Promise<void> {
  await ensureDir(agentsDir);

  const normalizedAgents = await Promise.all(
    agents.map(async (agent) => {
      const rawId = agent.id ?? agent.name ?? 'agent';
      const slugBase = slugify(rawId) || 'agent';
      const filename = `${slugBase}.md`;
      const promptFile = path.join(agentsDir, filename);
      await ensurePromptFile(promptFile);
      return { ...agent, promptPath: filename };
    }),
  );

  const target = path.join(agentsDir, 'agents-config.json');
  const json = `${JSON.stringify(normalizedAgents, null, 2)}\n`;
  await writeFileIfChanged(target, json);
}

/**
 * Ensures workspace scaffolding under `.codemachine/` and prepares the working directory.
 * Idempotent and safe to run repeatedly.
 */
export async function bootstrapWorkspace(options?: WorkspaceBootstrapOptions): Promise<void> {
  const desiredCwd = resolveDesiredCwd(options?.cwd);

  // Prepare workspace-rooted scaffolding directory tree.
  const workspaceRoot = desiredCwd;

  const agentRoots = Array.from(
    new Set([
      options?.projectRoot,
      workspaceRoot,
      ...CLI_ROOT_CANDIDATES
    ].filter((root): root is string => Boolean(root)))
  );

  // Ensure the working directory exists and use it for this process.
  await ensureDir(desiredCwd);
  try {
    process.chdir(desiredCwd);
  } catch {
    // If chdir fails, continue without throwing to avoid blocking other bootstrap steps.
  }

  // Prepare .codemachine tree under the workspace root.
  const cmRoot = path.join(workspaceRoot, '.codemachine');
  const agentsDir = path.join(cmRoot, 'agents');
  const inputsDir = path.join(cmRoot, 'inputs');
  const memoryDir = path.join(cmRoot, 'memory');
  const planDir = path.join(cmRoot, 'plan');

  await Promise.all([
    ensureDir(cmRoot),
    ensureDir(agentsDir),
    ensureDir(inputsDir),
    ensureDir(memoryDir),
    ensureDir(planDir)
  ]);

  // Ensure specifications template exists (do not overwrite if present).
  await ensureSpecificationsTemplate(inputsDir);

  // Load agents and mirror to JSON.
  const { subAgents } = await loadAgents(agentRoots);
  debugLog('Mirroring agents', { agentRoots, agentCount: subAgents.length });
  await mirrorAgentsToJson(agentsDir, subAgents);
}
