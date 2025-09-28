import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { resolveAgentsModulePath } from '../../shared/agents/paths.js';

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

type AgentDefinition = {
  id: string;
  [key: string]: unknown;
};

const MODEL = 'gpt-5-codex';
const MODEL_REASONING_EFFORT = 'high';
const DEFAULT_MODEL_EFFORT = 'medium';
const AGENT_EFFORT_MAP: Record<string, 'low' | 'medium' | 'high'> = {
  'frontend-dev': 'medium',
  'backend-dev': 'high',
  'uxui-designer': 'medium',
  'solution-architect': 'high',
  'software-architect': 'high',
  'technical-writer': 'low',
  'qa-engineer': 'medium',
  'performance-engineer': 'high'
};

function resolveProjectRoot(projectRoot?: string): string {
  if (projectRoot) {
    return projectRoot;
  }

  // Prefer the current working directory if it contains config/agents.js so local overrides win
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

function loadAgents(projectRoot: string): AgentDefinition[] {
  const modulePath = resolveAgentsModulePath({ projectRoot });
  if (!modulePath) {
    return [];
  }

  try {
    delete require.cache[require.resolve(modulePath)];
  } catch {
    // ignore cache miss
  }

  const loadedAgents = require(modulePath);
  return Array.isArray(loadedAgents) ? (loadedAgents as AgentDefinition[]) : [];
}

async function resolveCodexHome(codexHome?: string): Promise<string> {
  const targetHome = codexHome ?? process.env.CODEX_HOME ?? path.join(homedir(), '.codemachine', 'codex');
  await mkdir(targetHome, { recursive: true });
  return targetHome;
}

function toTomlString(value: string): string {
  return JSON.stringify(value);
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
      const effort = AGENT_EFFORT_MAP[agent.id] ?? DEFAULT_MODEL_EFFORT;
      return [
        `[profiles.${agent.id}]`,
        `model = ${toTomlString(MODEL)}`,
        `model_reasoning_effort = ${toTomlString(effort)}`
      ].join('\n');
    });

  if (profileSections.length > 0) {
    lines.push('', '# Profile configurations (dynamically generated from config/agents.js)');
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
};

export async function syncCodexConfig(options?: ConfigSyncOptions): Promise<void> {
  const projectRoot = resolveProjectRoot(options?.projectRoot);
  const agents = loadAgents(projectRoot);
  const codexHome = await resolveCodexHome(options?.codexHome);
  const configContent = buildConfigContent(agents);

  await writeConfigIfChanged(codexHome, configContent);
}
