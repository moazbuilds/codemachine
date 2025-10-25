import type { WorkflowStep } from '../../templates/index.js';
import { evaluateCheckpointBehavior } from './evaluator.js';
import { formatAgentLog } from '../../../shared/logging/index.js';
import type { WorkflowUIManager } from '../../../ui/index.js';

export interface CheckpointDecision {
  shouldStopWorkflow: boolean;
  reason?: string;
}

export async function handleCheckpointLogic(
  step: WorkflowStep,
  output: string,
  cwd: string,
  ui?: WorkflowUIManager,
): Promise<CheckpointDecision | null> {
  const checkpointDecision = await evaluateCheckpointBehavior({
    behavior: step.module?.behavior,
    output,
    cwd,
  });

  if (checkpointDecision?.shouldStopWorkflow) {
    const message = `${step.agentName} triggered a checkpoint` +
      `${checkpointDecision.reason ? `: ${checkpointDecision.reason}` : ''}.`;

    if (ui) {
      ui.logMessage(step.agentId, message);
      // Set checkpoint state for UI modal
      ui.setCheckpointState({
        active: true,
        reason: checkpointDecision.reason,
      });
    } else {
      console.log(formatAgentLog(step.agentId, message));
    }

    return {
      shouldStopWorkflow: true,
      reason: checkpointDecision.reason,
    };
  }

  return null;
}
