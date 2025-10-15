import type { WorkflowStep } from '../../templates/index.js';
import { evaluateTriggerBehavior } from './evaluator.js';
import { formatAgentLog } from '../../../shared/logging/index.js';

export interface TriggerDecision {
  shouldTrigger: boolean;
  triggerAgentId?: string;
  reason?: string;
}

export async function handleTriggerLogic(
  step: WorkflowStep,
  output: string,
  cwd: string,
): Promise<TriggerDecision | null> {
  const triggerDecision = await evaluateTriggerBehavior({
    behavior: step.module?.behavior,
    output,
    cwd,
  });

  if (process.env.CODEMACHINE_DEBUG_TRIGGERS === '1') {
    const tail = output.trim().split(/\n/).slice(-1)[0] ?? '';
    console.log(
      formatAgentLog(
        step.agentId,
        `[trigger] step=${step.agentName} behavior=${JSON.stringify(step.module?.behavior)} ` +
          `lastLine=${tail}`,
      ),
    );
  }

  if (triggerDecision?.shouldTrigger && triggerDecision.triggerAgentId) {
    console.log(
      formatAgentLog(
        step.agentId,
        `${step.agentName} is triggering agent '${triggerDecision.triggerAgentId}'` +
          `${triggerDecision.reason ? ` (${triggerDecision.reason})` : ''}.`,
      ),
    );

    return {
      shouldTrigger: true,
      triggerAgentId: triggerDecision.triggerAgentId,
      reason: triggerDecision.reason,
    };
  }

  if (triggerDecision?.reason) {
    console.log(formatAgentLog(step.agentId, `${step.agentName} trigger skipped: ${triggerDecision.reason}.`));
  }

  return null;
}
