import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ModuleBehavior } from '../../templates/index.js';
import type { BehaviorAction } from '../loop/evaluator.js';

export interface TriggerEvaluationOptions {
  behavior?: ModuleBehavior;
  output: string;
  cwd: string;
}

export interface TriggerEvaluationResult {
  shouldTrigger: boolean;
  triggerAgentId?: string;
  reason?: string;
}

export async function evaluateTriggerBehavior(options: TriggerEvaluationOptions): Promise<TriggerEvaluationResult | null> {
  const { behavior, cwd } = options;

  if (!behavior || behavior.type !== 'trigger' || behavior.action !== 'mainAgentCall') {
    return null;
  }

  // Check for behavior file
  const behaviorFile = path.join(cwd, '.codemachine', 'memory', 'behavior.json');

  // Read and parse behavior action
  let behaviorAction: BehaviorAction;
  try {
    const content = await fs.promises.readFile(behaviorFile, 'utf8');
    behaviorAction = JSON.parse(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // No file = no special behavior, continue normally
      return null;
    }
    console.error(`Failed to parse behavior file: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }

  // Handle trigger action
  if (behaviorAction.action === 'trigger') {
    const targetAgentId = behaviorAction.triggerAgentId || behavior.triggerAgentId;

    if (!targetAgentId) {
      console.error('Trigger action requires triggerAgentId in behavior.json or module configuration');
      return null;
    }

    return {
      shouldTrigger: true,
      triggerAgentId: targetAgentId,
      reason: behaviorAction.reason,
    };
  }

  // 'continue', 'loop', 'stop', or unknown action = no trigger behavior
  return null;
}
