import type { WorkflowStep } from '../templates/index.js';
import { formatAgentLog } from '../../shared/logging/index.js';

export interface ActiveLoop {
  skip: string[];
}

export function shouldSkipStep(
  step: WorkflowStep,
  index: number,
  completedSteps: number[],
  activeLoop: ActiveLoop | null,
): { skip: boolean; reason?: string } {
  // Skip step if executeOnce is true and it's already completed
  if (step.executeOnce && completedSteps.includes(index)) {
    return { skip: true, reason: `${step.agentName} skipped (already completed).` };
  }

  // Skip step if it's in the active loop's skip list
  if (activeLoop?.skip.includes(step.agentId)) {
    return { skip: true, reason: `${step.agentName} skipped (loop configuration).` };
  }

  return { skip: false };
}

export function logSkipDebug(step: WorkflowStep, activeLoop: ActiveLoop | null): void {
  if (process.env.CODEMACHINE_DEBUG_LOOPS === '1' && activeLoop) {
    console.log(
      formatAgentLog(
        step.agentId,
        `[skip-check] agentId=${step.agentId} skipList=[${activeLoop.skip.join(', ')}] shouldSkip=${activeLoop.skip.includes(step.agentId)}`,
      ),
    );
  }
}
