import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ModuleBehavior } from '../../templates/index.js';
import type { BehaviorAction } from '../types.js';

export interface LoopEvaluationOptions {
  behavior?: ModuleBehavior;
  output: string;
  iterationCount: number;
  cwd: string;
}

export interface LoopEvaluationResult {
  shouldRepeat: boolean;
  stepsBack: number;
  reason?: string;
}

export async function evaluateLoopBehavior(options: LoopEvaluationOptions): Promise<LoopEvaluationResult | null> {
  const { behavior, iterationCount, cwd } = options;

  if (!behavior || behavior.type !== 'loop' || behavior.action !== 'stepBack') {
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

  // Check if max iterations reached
  const maxIterations =
    typeof behavior.maxIterations === 'number' && behavior.maxIterations > 0
      ? Math.floor(behavior.maxIterations)
      : undefined;

  if (maxIterations !== undefined && iterationCount + 1 > maxIterations) {
    return {
      shouldRepeat: false,
      stepsBack: behavior.steps,
      reason: `loop limit reached (${maxIterations})`,
    };
  }

  // Handle behavior action
  if (behaviorAction.action === 'loop') {
    return {
      shouldRepeat: true,
      stepsBack: behavior.steps,
      reason: behaviorAction.reason,
    };
  }

  if (behaviorAction.action === 'stop') {
    return {
      shouldRepeat: false,
      stepsBack: behavior.steps,
      reason: behaviorAction.reason,
    };
  }

  // 'continue', 'checkpoint', 'trigger', or unknown action = no special behavior
  return null;
}
