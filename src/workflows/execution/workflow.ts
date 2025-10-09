import * as path from 'node:path';

import type { RunWorkflowOptions } from '../templates/index.js';
import { loadTemplateWithPath } from '../templates/index.js';
import {
  getAgentLoggers,
  formatAgentLog,
  startSpinner,
  stopSpinner,
  createSpinnerLoggers,
} from '../../shared/logging/index.js';
import {
  getTemplatePathFromTracking,
  getCompletedSteps,
  markStepCompleted,
} from '../../shared/workflows/index.js';
import { registry } from '../../infra/engines/index.js';
import { shouldSkipStep, logSkipDebug, type ActiveLoop } from '../behaviors/skip.js';
import { handleLoopLogic, createActiveLoop } from '../behaviors/loop/controller.js';
import { executeStep } from './step.js';

export async function runWorkflow(options: RunWorkflowOptions = {}): Promise<void> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();

  // Load template from .codemachine/template.json or use provided path
  const cmRoot = path.join(cwd, '.codemachine');
  const templatePath = options.templatePath || (await getTemplatePathFromTracking(cmRoot));

  const { template } = await loadTemplateWithPath(cwd, templatePath);

  console.log(`Using workflow template: ${template.name}`);

  // Sync agent configurations before running the workflow
  const workflowAgents = Array.from(
    template.steps
      .filter((step) => step.type === 'module')
      .reduce((acc, step) => {
        const id = step.agentId?.trim();
        if (!id) return acc;
        const existing = acc.get(id) ?? { id };
        acc.set(id, {
          ...existing,
          id,
          model: step.model ?? existing.model,
          modelReasoningEffort: step.modelReasoningEffort ?? existing.modelReasoningEffort,
        });
        return acc;
      }, new Map<string, { id: string; model?: unknown; modelReasoningEffort?: unknown }>()).values(),
  );

  // Sync agent configurations for engines that need it
  if (workflowAgents.length > 0) {
    const engines = registry.getAll();
    for (const engine of engines) {
      if (engine.syncConfig) {
        await engine.syncConfig({ additionalAgents: workflowAgents });
      }
    }
  }

  // Load completed steps for executeOnce tracking
  const completedSteps = await getCompletedSteps(cmRoot);

  const loopCounters = new Map<string, number>();
  let activeLoop: ActiveLoop | null = null;
  const workflowStartTime = Date.now();

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

    // Determine engine: step override > first authenticated engine
    let engineType: string;
    if (step.engine) {
      engineType = step.engine;

      // If an override is provided but not authenticated, log and fall back
      const overrideEngine = registry.get(engineType);
      const isOverrideAuthed = overrideEngine ? await overrideEngine.auth.isAuthenticated() : false;
      if (!isOverrideAuthed) {
        const pretty = overrideEngine?.metadata.name ?? engineType;
        console.error(
          formatAgentLog(
            step.agentId,
            `${pretty} override is not authenticated; falling back to first authenticated engine by order. Run 'codemachine auth login' to use ${pretty}.`,
          ),
        );

        // Find first authenticated engine by order
        const engines = registry.getAll();
        let fallbackEngine = null as typeof overrideEngine | null;
        for (const eng of engines) {
          if (await eng.auth.isAuthenticated()) {
            fallbackEngine = eng;
            break;
          }
        }

        // If none authenticated, fall back to registry default (may still require auth)
        if (!fallbackEngine) {
          fallbackEngine = registry.getDefault() ?? null;
        }

        if (fallbackEngine) {
          engineType = fallbackEngine.metadata.id;
          console.log(
            formatAgentLog(
              step.agentId,
              `Falling back to ${fallbackEngine.metadata.name} (${engineType})`,
            ),
          );
        }
      }
    } else {
      // Fallback: find first authenticated engine by order
      const engines = registry.getAll();
      let foundEngine = null;

      for (const engine of engines) {
        const isAuth = await engine.auth.isAuthenticated();
        if (isAuth) {
          foundEngine = engine;
          break;
        }
      }

      if (!foundEngine) {
        // If no authenticated engine, use default (first by order)
        foundEngine = registry.getDefault();
      }

      if (!foundEngine) {
        throw new Error('No engines registered. Please install at least one engine.');
      }

      engineType = foundEngine.metadata.id;
      console.log(formatAgentLog(step.agentId, `No engine specified, using ${foundEngine.metadata.name} (${engineType})`));
    }

    // Ensure the selected engine is used during execution
    // (executeStep falls back to default engine if step.engine is unset)
    // Mutate current step to carry the chosen engine forward
    (step as any).engine = engineType;

    const spinnerState = startSpinner(step.agentName, engineType, workflowStartTime);
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
