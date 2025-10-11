import type { WorkflowStep } from '../templates/index.js';
import {
  formatAgentLog,
  startSpinner,
  stopSpinner,
  createSpinnerLoggers,
  getAgentLoggers,
} from '../../shared/logging/index.js';
import { executeStep } from './step.js';
import { mainAgents } from '../utils/config.js';

export interface FallbackExecutionOptions {
  logger: (message: string) => void;
  stderrLogger: (message: string) => void;
}

/**
 * Checks if a fallback should be executed for this step.
 * Returns true if the step is in notCompletedSteps and has a fallback agent defined.
 */
export function shouldExecuteFallback(
  step: WorkflowStep,
  stepIndex: number,
  notCompletedSteps: number[],
): boolean {
  return notCompletedSteps.includes(stepIndex) && !!step.notCompletedFallback;
}

/**
 * Executes the fallback agent for a step that previously failed.
 * The fallback agent uses the same configuration (model, engine, etc.) as the original step.
 */
export async function executeFallbackStep(
  step: WorkflowStep,
  cwd: string,
  workflowStartTime: number,
  engineType: string,
): Promise<void> {
  if (!step.notCompletedFallback) {
    throw new Error('No fallback agent defined for this step');
  }

  const fallbackAgentId = step.notCompletedFallback;

  console.log(formatAgentLog(fallbackAgentId, `Fallback agent for ${step.agentName} started to work.`));

  // Look up the fallback agent's configuration to get its prompt path
  const fallbackAgent = mainAgents.find((agent) => agent?.id === fallbackAgentId);
  if (!fallbackAgent) {
    throw new Error(`Fallback agent not found: ${fallbackAgentId}`);
  }

  // Create a fallback step with the fallback agent's prompt path
  const fallbackStep: WorkflowStep = {
    ...step,
    agentId: fallbackAgentId,
    agentName: fallbackAgent.name || fallbackAgentId,
    promptPath: fallbackAgent.promptPath, // Use the fallback agent's prompt, not the original step's
  };

  const { stdout: baseStdoutLogger, stderr: baseStderrLogger } = getAgentLoggers(fallbackAgentId);

  const spinnerState = startSpinner(
    fallbackAgentId,
    engineType,
    workflowStartTime,
    step.model,
    step.modelReasoningEffort,
  );

  const { stdoutLogger, stderrLogger } = createSpinnerLoggers(
    baseStdoutLogger,
    baseStderrLogger,
    spinnerState,
  );

  try {
    await executeStep(fallbackStep, cwd, {
      logger: stdoutLogger,
      stderrLogger,
    });

    stopSpinner(spinnerState);
    console.log(formatAgentLog(fallbackAgentId, `Fallback agent completed successfully.`));
    console.log('═'.repeat(80));
  } catch (error) {
    stopSpinner(spinnerState);
    console.error(
      formatAgentLog(
        fallbackAgentId,
        `Fallback agent failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    throw error; // Re-throw to prevent original step from running
  }
}
