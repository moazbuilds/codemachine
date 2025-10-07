import * as path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import type { WorkflowStep } from '../templates/index.js';
import { runAgent } from '../../infra/engines/codex/index.js';
import { processPromptString } from '../../infra/prompts/index.js';

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

  const output = await runAgent(step.agentId, prompt, cwd, {
    logger: options.logger,
    stderrLogger: options.stderrLogger,
    timeout,
  });

  const agentName = step.agentName.toLowerCase();

  if (step.agentId === 'agents-builder' || agentName.includes('builder')) {
    await runAgentsBuilderStep(cwd);
  }

  return output;
}
