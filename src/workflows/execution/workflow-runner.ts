import * as path from 'node:path';

import type { RunWorkflowOptions } from '../templates/index.js';
import { loadTemplateWithPath } from '../templates/index.js';
import {
  getAgentLoggers,
  formatAgentLog,
  startSpinner,
  stopSpinner,
  createSpinnerLoggers,
} from '../../../../shared/logging/index.js';
import {
  getTemplatePathFromTracking,
  getCompletedSteps,
  markStepCompleted,
} from '../../../../shared/agents/template-tracking.js';
import { syncWorkflowAgents } from './config-sync.js';
import { shouldSkipStep, logSkipDebug, type ActiveLoop } from './step-filter.js';
import { handleLoopLogic, createActiveLoop } from './loop/controller.js';
import { executeStep } from './step-executor.js';

export async function runWorkflow(options: RunWorkflowOptions = {}): Promise<void> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();

  // Load template from .codemachine/template.json or use provided path
  const cmRoot = path.join(cwd, '.codemachine');
  const templatePath = options.templatePath || (await getTemplatePathFromTracking(cmRoot));

  const { template } = await loadTemplateWithPath(cwd, templatePath);

  console.log(`Using workflow template: ${template.name}`);

  await syncWorkflowAgents(template);

  // Load completed steps for executeOnce tracking
  const completedSteps = await getCompletedSteps(cmRoot);

  const loopCounters = new Map<string, number>();
  let activeLoop: ActiveLoop | null = null;

  for (let index = 0; index < template.steps.length; index += 1) {
    const step = template.steps[index];
    if (step.type !== 'module') {
      continue;
    }

    const skipResult = shouldSkipStep(step, index, completedSteps, activeLoop);
    if (skipResult.skip) {
      console.log(formatAgentLog(step.agentId, skipResult.reason!));
      continue;
    }

    logSkipDebug(step, activeLoop);

    console.log('═'.repeat(80));
    console.log(formatAgentLog(step.agentId, `${step.agentName} started to work.`));

    const { stdout: baseStdoutLogger, stderr: baseStderrLogger } = getAgentLoggers(step.agentId);
    const spinnerState = startSpinner(step.agentName);
    const { stdoutLogger, stderrLogger } = createSpinnerLoggers(
      baseStdoutLogger,
      baseStderrLogger,
      spinnerState,
    );

    try {
      const output = await executeStep(step, cwd, {
        logger: stdoutLogger,
        stderrLogger,
      });

      const loopResult = handleLoopLogic(step, index, output, loopCounters);

      if (loopResult.decision?.shouldRepeat) {
        // Set active loop with skip list
        activeLoop = createActiveLoop(loopResult.decision);
        stopSpinner(spinnerState);
        index = loopResult.newIndex;
        continue;
      }

      // Clear active loop only when a loop step explicitly terminates
      const newActiveLoop = createActiveLoop(loopResult.decision);
      if (newActiveLoop !== (undefined as unknown as ActiveLoop | null)) {
        activeLoop = newActiveLoop;
      }

      stopSpinner(spinnerState);

      // Mark step as completed if executeOnce is true
      if (step.executeOnce) {
        await markStepCompleted(cmRoot, index);
      }

      console.log(formatAgentLog(step.agentId, `${step.agentName} has completed their work.`));
      console.log('\n' + '═'.repeat(80) + '\n');
    } catch (error) {
      stopSpinner(spinnerState);
      console.error(
        formatAgentLog(
          step.agentId,
          `${step.agentName} failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      throw error;
    }
  }
}
