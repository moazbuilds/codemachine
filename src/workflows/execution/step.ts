import * as path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import type { WorkflowStep } from '../templates/index.js';
import type { EngineType } from '../../infra/engines/index.js';
import { getEngine } from '../../infra/engines/index.js';
import { processPromptString } from '../../shared/prompts/index.js';

export interface StepExecutorOptions {
  logger: (chunk: string) => void;
  stderrLogger: (chunk: string) => void;
  timeout?: number;
}

async function ensureProjectScaffold(cwd: string): Promise<void> {
  const agentsDir = path.resolve(cwd, '.codemachine', 'agents');
  const planDir = path.resolve(cwd, '.codemachine', 'plan');
  await mkdir(agentsDir, { recursive: true });
  await mkdir(planDir, { recursive: true });
}

async function runAgentsBuilderStep(cwd: string): Promise<void> {
  await ensureProjectScaffold(cwd);
}

/**
 * Ensures the engine is authenticated
 */
async function ensureEngineAuth(engineType: EngineType, _profile: string): Promise<void> {
  const { registry } = await import('../../infra/engines/index.js');
  const engine = registry.get(engineType);

  if (!engine) {
    const availableEngines = registry.getAllIds().join(', ');
    throw new Error(
      `Unknown engine type: ${engineType}. Available engines: ${availableEngines}`
    );
  }

  const isAuthed = await engine.auth.isAuthenticated();
  if (!isAuthed) {
    console.error(`\n${engine.metadata.name} authentication required`);
    console.error(`\nRun the following command to authenticate:\n`);
    console.error(`  codemachine auth login\n`);
    throw new Error(`${engine.metadata.name} authentication required`);
  }
}

/**
 * Executes a workflow step (main agent)
 * Step already has all the data from resolveStep() - no config loading needed
 */
export async function executeStep(
  step: WorkflowStep,
  cwd: string,
  options: StepExecutorOptions,
): Promise<string> {
  const promptPath = path.isAbsolute(step.promptPath)
    ? step.promptPath
    : path.resolve(cwd, step.promptPath);
  const rawPrompt = await readFile(promptPath, 'utf8');
  const prompt = await processPromptString(rawPrompt, cwd);

  // Use environment variable or default to 10 minutes (600000ms)
  const timeout =
    options.timeout ??
    (process.env.CODEMACHINE_AGENT_TIMEOUT
      ? Number.parseInt(process.env.CODEMACHINE_AGENT_TIMEOUT, 10)
      : 600000);

  // Determine engine: step override > default to first registered engine
  const { registry } = await import('../../infra/engines/index.js');
  const defaultEngine = registry.getDefault();
  if (!defaultEngine) {
    throw new Error('No engines registered. Please install at least one engine.');
  }
  const engineType: EngineType = step.engine ?? defaultEngine.metadata.id;
  const profile = step.agentId;

  // Ensure authentication
  await ensureEngineAuth(engineType, profile);

  // Get engine and its metadata for defaults
  const engineModule = registry.get(engineType);
  if (!engineModule) {
    throw new Error(`Engine not found: ${engineType}`);
  }
  const engine = getEngine(engineType);

  // Model resolution: step override > engine default
  const model = step.model ?? engineModule.metadata.defaultModel;
  const modelReasoningEffort = step.modelReasoningEffort ?? engineModule.metadata.defaultModelReasoningEffort;

  const result = await engine.run({
    profile,
    prompt,
    workingDir: cwd,
    model,
    modelReasoningEffort,
    onData: (chunk) => {
      options.logger(chunk);
    },
    onErrorData: (chunk) => {
      options.stderrLogger(chunk);
    },
    timeout,
  });

  const agentName = step.agentName.toLowerCase();

  if (step.agentId === 'agents-builder' || agentName.includes('builder')) {
    await runAgentsBuilderStep(cwd);
  }

  return result.stdout;
}
