import type { WorkflowStep } from '../templates/index.js';
import { isModuleStep } from '../templates/types.js';
import { formatAgentLog } from '../../shared/logging/index.js';
import type { WorkflowUIManager } from '../../ui/index.js';

export interface ActiveLoop {
  skip: string[];
}

export function shouldSkipStep(
  step: WorkflowStep,
  index: number,
  completedSteps: number[],
  activeLoop: ActiveLoop | null,
  ui?: WorkflowUIManager,
  uniqueAgentId?: string,
): { skip: boolean; reason?: string } {
  // UI steps can't be skipped
  if (!isModuleStep(step)) {
    return { skip: false };
  }

  // Use provided unique agent ID or fall back to step.agentId
  const agentId = uniqueAgentId ?? step.agentId;

  // Skip step if executeOnce is true and it's already completed
  if (step.executeOnce && completedSteps.includes(index)) {
    ui?.updateAgentStatus(agentId, 'skipped');
    return { skip: true, reason: `${step.agentName} skipped (already completed).` };
  }

  // Skip step if it's in the active loop's skip list
  if (activeLoop?.skip.includes(step.agentId)) {
    ui?.updateAgentStatus(agentId, 'skipped');
    return { skip: true, reason: `${step.agentName} skipped (loop configuration).` };
  }

  return { skip: false };
}

export function logSkipDebug(step: WorkflowStep, activeLoop: ActiveLoop | null): void {
  if (!isModuleStep(step)) {
    return;
  }

  if (process.env.CODEMACHINE_DEBUG_LOOPS === '1' && activeLoop) {
    console.log(
      formatAgentLog(
        step.agentId,
        `[skip-check] agentId=${step.agentId} skipList=[${activeLoop.skip.join(', ')}] shouldSkip=${activeLoop.skip.includes(step.agentId)}`,
      ),
    );
  }
}
