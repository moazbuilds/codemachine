import { createRequire } from 'node:module';
import { existsSync, readdirSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = (() => {
  let current = moduleDir;
  while (true) {
    if (existsSync(path.join(current, 'package.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return moduleDir;
    current = parent;
  }
})();

interface AgentConfig {
  id: string;
  name?: string;
  promptPath?: string;
  model?: string;
  modelReasoningEffort?: string;
  type?: string;
  [key: string]: unknown;
}

interface ModuleBehaviorConfig {
  type?: string;
  action?: string;
  steps?: number;
  trigger?: string;
  maxIterations?: number;
  skip?: string[];
  [key: string]: unknown;
}

interface ModuleConfig extends AgentConfig {
  behavior?: ModuleBehaviorConfig;
}

const require = createRequire(import.meta.url);
const mainAgents = require(path.resolve(packageRoot, 'config', 'main.agents.js')) as AgentConfig[];
const moduleCatalog = require(path.resolve(packageRoot, 'config', 'modules.js')) as ModuleConfig[];

interface StepOverrides {
  agentName?: string;
  promptPath?: string;
  model?: string;
  modelReasoningEffort?: string;
  executeOnce?: boolean;
}

interface WorkflowStep {
  type: string;
  agentId: string;
  agentName: string;
  promptPath: string;
  model: string;
  modelReasoningEffort?: string;
  module?: ModuleMetadata;
  executeOnce?: boolean;
}

interface LoopBehaviorConfig {
  type: 'loop';
  action: 'stepBack';
  steps: number;
  trigger: string;
  maxIterations?: number;
  skip?: string[];
}

interface ModuleMetadata {
  id: string;
  behavior?: LoopBehaviorConfig;
}

interface ModuleOverrides extends StepOverrides {
  loopTrigger?: string;
  loopSteps?: number;
  loopMaxIterations?: number;
  loopSkip?: string[];
}

function extractOrderPrefix(filename: string): number | null {
  const match = filename.match(/^(\d+)\s*-/);
  return match ? parseInt(match[1], 10) : null;
}

export function resolveStep(id: string, overrides: StepOverrides = {}): WorkflowStep {
  const agent = mainAgents.find((entry) => entry?.id === id);
  if (!agent) {
    throw new Error(`Unknown main agent: ${id}`);
  }

  const agentName = overrides.agentName ?? agent.name;
  const promptPath = overrides.promptPath ?? agent.promptPath;
  const model = overrides.model ?? agent.model;

  if (!agentName || !promptPath || !model) {
    throw new Error(`Agent ${id} is missing required fields (name, promptPath, or model)`);
  }

  return {
    type: 'module',
    agentId: agent.id,
    agentName,
    promptPath,
    model,
    modelReasoningEffort: overrides.modelReasoningEffort ?? agent.modelReasoningEffort,
    executeOnce: overrides.executeOnce,
  };
}

function resolveLoopBehavior(
  base: ModuleBehaviorConfig | undefined,
  overrides: ModuleOverrides,
): LoopBehaviorConfig | undefined {
  if (!base || base.type !== 'loop' || base.action !== 'stepBack') {
    return undefined;
  }

  const trigger = overrides.loopTrigger ?? (typeof base.trigger === 'string' ? base.trigger : undefined);
  if (!trigger || !trigger.trim()) {
    return undefined;
  }

  const overrideSteps = typeof overrides.loopSteps === 'number' ? overrides.loopSteps : undefined;
  const baseSteps = typeof base.steps === 'number' ? base.steps : undefined;
  const stepsCandidate = overrideSteps ?? baseSteps ?? 1;
  const steps = stepsCandidate > 0 ? Math.floor(stepsCandidate) : 1;
  const maxIterationsCandidate = overrides.loopMaxIterations ?? base.maxIterations;
  const maxIterations = typeof maxIterationsCandidate === 'number' && maxIterationsCandidate > 0
    ? Math.floor(maxIterationsCandidate)
    : undefined;

  return {
    type: 'loop',
    action: 'stepBack',
    steps,
    trigger,
    maxIterations,
    skip: overrides.loopSkip ?? base.skip,
  };
}

export function resolveModule(id: string, overrides: ModuleOverrides = {}): WorkflowStep {
  const moduleEntry = moduleCatalog.find((entry) => entry?.id === id);

  if (!moduleEntry) {
    throw new Error(`Unknown workflow module: ${id}`);
  }

  const agentName = overrides.agentName ?? moduleEntry.name ?? moduleEntry.id;
  const promptPath = overrides.promptPath ?? moduleEntry.promptPath;
  const model = overrides.model ?? moduleEntry.model;
  const modelReasoningEffort = overrides.modelReasoningEffort ?? moduleEntry.modelReasoningEffort;

  if (typeof promptPath !== 'string' || !promptPath.trim()) {
    throw new Error(`Module ${id} is missing a promptPath configuration.`);
  }

  if (typeof model !== 'string' || !model.trim()) {
    throw new Error(`Module ${id} is missing a model configuration.`);
  }

  const behavior = resolveLoopBehavior(moduleEntry.behavior, overrides);

  return {
    type: 'module',
    agentId: moduleEntry.id,
    agentName,
    promptPath,
    model,
    modelReasoningEffort,
    module: {
      id: moduleEntry.id,
      behavior,
    },
  };
}

export function resolveFolder(folderName: string, overrides: StepOverrides = {}): WorkflowStep[] {
  // Look up folder configuration from main.agents.js
  const folderConfig = mainAgents.find((entry) => entry?.type === 'folder' && entry?.id === folderName);

  if (!folderConfig) {
    throw new Error(`Folder configuration not found in main.agents.js: ${folderName}`);
  }

  const promptsDir = path.resolve(packageRoot, 'prompts', 'templates', folderName);

  if (!existsSync(promptsDir) || !statSync(promptsDir).isDirectory()) {
    throw new Error(`Folder not found: prompts/templates/${folderName}`);
  }

  const files = readdirSync(promptsDir);

  // Filter and sort files by their numeric prefix
  const orderedFiles = files
    .map((file) => ({
      file,
      order: extractOrderPrefix(file),
      fullPath: path.join(promptsDir, file),
    }))
    .filter((item) => item.order !== null && statSync(item.fullPath).isFile())
    .sort((a, b) => (a.order! - b.order!));

  if (orderedFiles.length === 0) {
    throw new Error(`No ordered files found in folder: prompts/templates/${folderName}`);
  }

  // Create a step for each file using folder config
  return orderedFiles.map((item) => {
    const basename = item.file;
    const ext = path.extname(basename);

    // Remove number prefix and extension to get the agent ID
    const agentId = basename.replace(/^\d+\s*-\s*/, '').replace(ext, '').trim();
    const promptPath = `prompts/templates/${folderName}/${basename}`;
    const model = overrides.model ?? folderConfig.model;

    if (!model) {
      throw new Error(`Folder config ${folderName} is missing a model configuration`);
    }

    return {
      type: 'module',
      agentId,
      agentName: overrides.agentName ?? agentId.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      promptPath: overrides.promptPath ?? promptPath,
      model,
      modelReasoningEffort: overrides.modelReasoningEffort ?? folderConfig.modelReasoningEffort,
    };
  });
}
