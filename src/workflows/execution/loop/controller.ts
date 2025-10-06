import type { WorkflowStep } from '../templates/index.js';
import { evaluateLoopBehavior } from './evaluator.js';
import { formatAgentLog } from '../../../../../shared/logging/index.js';
import type { ActiveLoop } from '../step-filter.js';

export interface LoopDecision {
  shouldRepeat: boolean;
  stepsBack: number;
  skipList: string[];
  reason?: string;
}

export function handleLoopLogic(
  step: WorkflowStep,
  index: number,
  output: string,
  loopCounters: Map<string, number>,
): { decision: LoopDecision | null; newIndex: number } {
  const loopKey = `${step.module?.id ?? step.agentId}:${index}`;
  const iterationCount = loopCounters.get(loopKey) ?? 0;
  const loopDecision = evaluateLoopBehavior({
    behavior: step.module?.behavior,
    output,
    iterationCount,
  });

  if (process.env.CODEMACHINE_DEBUG_LOOPS === '1') {
    const tail = output.trim().split(/\n/).slice(-1)[0] ?? '';
    console.log(
      formatAgentLog(
        step.agentId,
        `[loop] step=${step.agentName} behavior=${JSON.stringify(step.module?.behavior)} ` +
          `iteration=${iterationCount} lastLine=${tail}`,
      ),
    );
  }

  if (loopDecision?.shouldRepeat) {
    const nextIterationCount = iterationCount + 1;
    loopCounters.set(loopKey, nextIterationCount);
    const stepsBack = Math.max(1, loopDecision.stepsBack);
    const rewindIndex = Math.max(-1, index - stepsBack - 1);

    const skipList = step.module?.behavior?.skip ?? [];
    const skipInfo = skipList.length > 0 ? ` (skipping: ${skipList.join(', ')})` : '';

    console.log(
      formatAgentLog(
        step.agentId,
        `${step.agentName} triggered a loop (match: ${step.module?.behavior?.trigger}); ` +
          `repeating previous step. Iteration ${nextIterationCount}${
            step.module?.behavior?.maxIterations ? `/${step.module.behavior.maxIterations}` : ''
          }${skipInfo}.`,
      ),
    );

    return {
      decision: { shouldRepeat: true, stepsBack, skipList, reason: loopDecision.reason },
      newIndex: rewindIndex,
    };
  }

  if (loopDecision?.reason) {
    console.log(formatAgentLog(step.agentId, `${step.agentName} loop skipped: ${loopDecision.reason}.`));
  }

  // Clear loop counter when loop terminates
  if (loopDecision !== null && !loopDecision.shouldRepeat) {
    loopCounters.set(loopKey, 0);
  }

  return { decision: null, newIndex: index };
}

export function createActiveLoop(decision: LoopDecision | null): ActiveLoop | null {
  if (decision?.shouldRepeat) {
    return { skip: decision.skipList };
  }
  // Clear active loop only when a loop step explicitly terminates (shouldRepeat=false)
  if (decision !== null && !decision.shouldRepeat) {
    return null;
  }
  // Return undefined to indicate no change to activeLoop
  return undefined as unknown as ActiveLoop | null;
}
