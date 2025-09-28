import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const require = createRequire(import.meta.url);

function resolveProjectRoot(projectRoot?: string): string {
  if (projectRoot) {
    return projectRoot;
  }

  // Prefer the current working directory if it contains inputs/agents.js
  const cwd = process.cwd();
  const cwdAgents = path.join(cwd, 'inputs', 'agents.js');
  if (existsSync(cwdAgents)) {
    return cwd;
  }

  // Fallback to repo root relative to compiled file location
  return path.resolve(__dirname, '..', '..', '..');
}

function loadAgents(projectRoot: string): AgentDefinition[] {
  const cjsPath = path.join(projectRoot, 'inputs', 'agents.cjs');
  const jsPath = path.join(projectRoot, 'inputs', 'agents.js');
  const agentsModulePath = existsSync(cjsPath) ? cjsPath : jsPath;
  const loadedAgents = require(agentsModulePath);
  return Array.isArray(loadedAgents) ? loadedAgents : [];
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
    lines.push('', '# Profile configurations (dynamically generated from agents.js)');
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
