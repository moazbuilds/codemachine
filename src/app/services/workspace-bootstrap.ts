import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);

type AgentDefinition = Record<string, unknown>;

export type WorkspaceBootstrapOptions = {
  projectRoot?: string;
  cwd?: string; // target working directory for this run
};

function resolveProjectRoot(projectRoot?: string): string {
  if (projectRoot) return projectRoot;
  const cwd = process.cwd();
  // Prefer current workspace if it contains inputs/agents.*
  const cwdAgentsJs = path.join(cwd, 'inputs', 'agents.js');
  const cwdAgentsCjs = path.join(cwd, 'inputs', 'agents.cjs');
  if (existsSync(cwdAgentsJs) || existsSync(cwdAgentsCjs)) {
    return cwd;
  }
  return path.resolve(__dirname, '..', '..', '..');
}

function resolveDesiredCwd(explicitCwd?: string): string {
  return explicitCwd ?? process.env.CODEMACHINE_CWD ?? process.cwd();
}

function loadAgents(projectRoot: string): AgentDefinition[] {
  const cjsPath = path.join(projectRoot, 'inputs', 'agents.cjs');
  const jsPath = path.join(projectRoot, 'inputs', 'agents.js');
  const agentsModulePath = existsSync(cjsPath) ? cjsPath : jsPath;
  // Bust require cache to reflect latest edits
  try {
    delete require.cache[require.resolve(agentsModulePath)];
  } catch {
    // ignore if resolution fails
  }
  const loadedAgents = require(agentsModulePath);
  return Array.isArray(loadedAgents) ? (loadedAgents as AgentDefinition[]) : [];
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

async function mirrorAgentsToJson(agentsDir: string, agents: AgentDefinition[]): Promise<void> {
  await ensureDir(agentsDir);
  const target = path.join(agentsDir, 'agents-config.json');
  const json = `${JSON.stringify(agents, null, 2)}\n`;
  await writeFileIfChanged(target, json);
}

/**
 * Ensures workspace scaffolding under `.codemachine/` and prepares the working directory.
 * Idempotent and safe to run repeatedly.
 */
export async function bootstrapWorkspace(options?: WorkspaceBootstrapOptions): Promise<void> {
  const projectRoot = resolveProjectRoot(options?.projectRoot);
  const desiredCwd = resolveDesiredCwd(options?.cwd);

  // Ensure the working directory exists and use it for this process.
  await ensureDir(desiredCwd);
  try {
    process.chdir(desiredCwd);
  } catch {
    // If chdir fails, continue without throwing to avoid blocking other bootstrap steps.
  }

  // Prepare .codemachine tree under the project root.
  const cmRoot = path.join(projectRoot, '.codemachine');
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
  const agents = loadAgents(projectRoot);
  await mirrorAgentsToJson(agentsDir, agents);
}
