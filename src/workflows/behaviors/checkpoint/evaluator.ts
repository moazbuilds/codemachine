import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ModuleBehavior } from '../../templates/index.js';
import type { BehaviorAction } from '../types.js';

export interface CheckpointEvaluationOptions {
  behavior?: ModuleBehavior;
  output: string;
  cwd: string;
}

export interface CheckpointEvaluationResult {
  shouldStopWorkflow: boolean;
  reason?: string;
}

export async function evaluateCheckpointBehavior(options: CheckpointEvaluationOptions): Promise<CheckpointEvaluationResult | null> {
  const { cwd } = options;

  // Checkpoint is universal - any agent can write checkpoint to behavior.json
  // No need to check if step has checkpoint behavior configured

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

  // Handle checkpoint action
  if (behaviorAction.action === 'checkpoint') {
    return {
      shouldStopWorkflow: true,
      reason: behaviorAction.reason,
    };
  }

  // 'continue', 'loop', 'trigger', or unknown action = no checkpoint behavior
  return null;
}
