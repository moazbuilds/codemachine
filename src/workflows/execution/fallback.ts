import type { WorkflowStep } from '../templates/index.js';
import {
  formatAgentLog,
} from '../../shared/logging/index.js';
import { executeStep } from './step.js';
import { mainAgents } from '../utils/config.js';
import type { WorkflowUIManager } from '../../ui/index.js';
import { isValidEngineType } from '../../infra/engines/core/types.js';

export interface FallbackExecutionOptions {
  logger: (message: string) => void;
  stderrLogger: (message: string) => void;
  ui?: WorkflowUIManager;
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
  ui?: WorkflowUIManager,
): Promise<void> {
  if (!step.notCompletedFallback) {
    throw new Error('No fallback agent defined for this step');
  }

  const fallbackAgentId = step.notCompletedFallback;

  if (ui) {
    ui.logMessage(fallbackAgentId, `Fallback agent for ${step.agentName} started to work.`);
  }

  // Look up the fallback agent's configuration to get its prompt path
  const fallbackAgent = mainAgents.find((agent) => agent?.id === fallbackAgentId);
  if (!fallbackAgent) {
    throw new Error(`Fallback agent not found: ${fallbackAgentId}`);
  }

  if (!fallbackAgent.promptPath) {
    throw new Error(`Fallback agent ${fallbackAgentId} is missing a promptPath configuration`);
  }

  // Create a fallback step with the fallback agent's prompt path
  const fallbackStep: WorkflowStep = {
    ...step,
    agentId: fallbackAgentId,
    agentName: fallbackAgent.name || fallbackAgentId,
    promptPath: fallbackAgent.promptPath, // Use the fallback agent's prompt, not the original step's
  };

  // Add fallback agent to UI as sub-agent
  if (ui) {
    const engineName = engineType; // preserve original engine type, even if unknown
    ui.addSubAgent(step.agentId, {
      id: fallbackAgentId,
      name: fallbackAgent.name || fallbackAgentId,
      engine: engineName,
      status: 'running',
      parentId: step.agentId,
      startTime: Date.now(),
      telemetry: { tokensIn: 0, tokensOut: 0 },
      toolCount: 0,
      thinkingCount: 0,
    });
  }

  try {
    await executeStep(fallbackStep, cwd, {
      logger: (chunk) => ui?.handleOutputChunk(fallbackAgentId, chunk),
      stderrLogger: (chunk) => ui?.handleOutputChunk(fallbackAgentId, chunk),
      ui,
    });

    // Update UI status on success
    if (ui) {
      ui.updateAgentStatus(fallbackAgentId, 'completed');
      ui.logMessage(fallbackAgentId, `Fallback agent completed successfully.`);
      ui.logMessage(fallbackAgentId, '═'.repeat(80));
    }
  } catch (error) {
    // Don't update status to failed - let it stay as running/retrying
    console.error(
      formatAgentLog(
        fallbackAgentId,
        `Fallback agent failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    throw error; // Re-throw to prevent original step from running
  }
}
