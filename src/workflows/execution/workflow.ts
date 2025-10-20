import * as path from 'node:path';
import * as fs from 'node:fs';

import type { RunWorkflowOptions } from '../templates/index.js';
import { loadTemplateWithPath } from '../templates/index.js';
import {
  formatAgentLog,
} from '../../shared/logging/index.js';
import {
  getTemplatePathFromTracking,
  getCompletedSteps,
  getNotCompletedSteps,
  markStepCompleted,
  markStepStarted,
  removeFromNotCompleted,
  getResumeStartIndex,
} from '../../shared/workflows/index.js';
import { registry } from '../../infra/engines/index.js';
import { shouldSkipStep, logSkipDebug, type ActiveLoop } from '../behaviors/skip.js';
import { handleLoopLogic, createActiveLoop } from '../behaviors/loop/controller.js';
import { handleTriggerLogic } from '../behaviors/trigger/controller.js';
import { executeStep } from './step.js';
import { executeTriggerAgent } from './trigger.js';
import { shouldExecuteFallback, executeFallbackStep } from './fallback.js';
import { WorkflowUIManager } from '../../ui/index.js';

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

  // Load not completed steps for fallback tracking
  const notCompletedSteps = await getNotCompletedSteps(cmRoot);

  const loopCounters = new Map<string, number>();
  let activeLoop: ActiveLoop | null = null;
  const workflowStartTime = Date.now();

  // Initialize Workflow UI Manager
  const ui = new WorkflowUIManager(template.name, template.steps.length);

  // Pre-populate timeline with all workflow steps BEFORE starting UI
  // This prevents duplicate renders at startup
  // Set initial status based on completion tracking
  template.steps.forEach((step, stepIndex) => {
    if (step.type === 'module') {
      const defaultEngine = registry.getDefault();
      const engineType = step.engine ?? defaultEngine?.metadata.id ?? 'unknown';
      const engineName = (engineType === 'claude' || engineType === 'codex' || engineType === 'cursor')
        ? engineType
        : 'claude'; // fallback to claude for unknown engines

      // Determine initial status based on completion tracking
      let initialStatus: 'pending' | 'completed' | 'failed' = 'pending';
      if (completedSteps.includes(stepIndex)) {
        initialStatus = 'completed';
      } else if (notCompletedSteps.includes(stepIndex)) {
        initialStatus = 'failed';
      }

      ui.addMainAgent(step.agentName ?? step.agentId, engineName, stepIndex, initialStatus);
    }
  });

  // Start UI after all agents are pre-populated (single clean render)
  ui.start();

  // Get the starting index based on resume configuration
  const startIndex = await getResumeStartIndex(cmRoot);

  if (startIndex > 0) {
    console.log(`Resuming workflow from step ${startIndex}...`);
  }

  try {
    for (let index = startIndex; index < template.steps.length; index += 1) {
    const step = template.steps[index];
    if (step.type !== 'module') {
      continue;
    }

    const skipResult = shouldSkipStep(step, index, completedSteps, activeLoop, ui);
    if (skipResult.skip) {
      ui.logMessage(step.agentId, skipResult.reason!);
      continue;
    }

    logSkipDebug(step, activeLoop);

    ui.logMessage(step.agentId, '═'.repeat(80));
    ui.logMessage(step.agentId, `${step.agentName} started to work.`);

    // Update UI status to running
    ui.updateAgentStatus(step.agentId, 'running');

    // Reset behavior file to default "continue" before each agent run
    const behaviorFile = path.join(cwd, '.codemachine/memory/behavior.json');
    const behaviorDir = path.dirname(behaviorFile);
    if (!fs.existsSync(behaviorDir)) {
      fs.mkdirSync(behaviorDir, { recursive: true });
    }
    fs.writeFileSync(behaviorFile, JSON.stringify({ action: 'continue' }, null, 2));

    // Mark step as started (adds to notCompletedSteps)
    await markStepStarted(cmRoot, index);

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
      ui.logMessage(step.agentId, `No engine specified, using ${foundEngine.metadata.name} (${engineType})`);
    }

    // Ensure the selected engine is used during execution
    // (executeStep falls back to default engine if step.engine is unset)
    // Mutate current step to carry the chosen engine forward
    step.engine = engineType;

    // Check if fallback should be executed before the original step
    if (shouldExecuteFallback(step, index, notCompletedSteps)) {
      ui.logMessage(step.agentId, `Detected incomplete step. Running fallback agent first.`);
      try {
        await executeFallbackStep(step, cwd, workflowStartTime, engineType, ui);
      } catch (error) {
        // Fallback failed, step remains in notCompletedSteps
        console.error(
          formatAgentLog(
            step.agentId,
            `Fallback failed. Skipping original step retry.`,
          ),
        );
        ui.updateAgentStatus(step.agentId, 'failed');
        throw error;
      }
    }

    try {
      const output = await executeStep(step, cwd, {
        logger: (chunk) => ui.handleOutputChunk(step.agentId, chunk),
        stderrLogger: (chunk) => ui.handleOutputChunk(step.agentId, chunk),
        ui,
      });

      // Check for trigger behavior first
      const triggerResult = await handleTriggerLogic(step, output, cwd, ui);
      if (triggerResult?.shouldTrigger && triggerResult.triggerAgentId) {
        const triggeredAgentId = triggerResult.triggerAgentId; // Capture for use in callbacks
        try {
          await executeTriggerAgent({
            triggerAgentId: triggeredAgentId,
            cwd,
            engineType,
            logger: (chunk) => ui.handleOutputChunk(triggeredAgentId, chunk),
            stderrLogger: (chunk) => ui.handleOutputChunk(triggeredAgentId, chunk),
            sourceAgentId: step.agentId,
            ui,
          });
        } catch (_triggerError) {
          // Continue with workflow even if triggered agent fails
        }
      }

      const loopResult = await handleLoopLogic(step, index, output, loopCounters, cwd, ui);

      if (loopResult.decision?.shouldRepeat) {
        // Set active loop with skip list
        activeLoop = createActiveLoop(loopResult.decision);

        // Update UI loop state
        const loopKey = `${step.module?.id ?? step.agentId}:${index}`;
        const iteration = (loopCounters.get(loopKey) || 0) + 1;
        ui.setLoopState({
          active: true,
          sourceAgent: step.agentId,
          backSteps: loopResult.decision.stepsBack,
          iteration,
          maxIterations: step.module?.behavior?.type === 'loop' ? step.module.behavior.maxIterations ?? Infinity : Infinity,
          skipList: loopResult.decision.skipList || [],
        });

        index = loopResult.newIndex;
        continue;
      }

      // Clear active loop only when a loop step explicitly terminates
      const newActiveLoop = createActiveLoop(loopResult.decision);
      if (newActiveLoop !== (undefined as unknown as ActiveLoop | null)) {
        activeLoop = newActiveLoop;
        if (!newActiveLoop) {
          ui.setLoopState(null);
        }
      }

      // Remove from notCompletedSteps (step finished successfully)
      await removeFromNotCompleted(cmRoot, index);

      // Mark step as completed if executeOnce is true
      if (step.executeOnce) {
        await markStepCompleted(cmRoot, index);
      }

      // Update UI status to completed
      ui.updateAgentStatus(step.agentId, 'completed');

      ui.logMessage(step.agentId, `${step.agentName} has completed their work.`);
      ui.logMessage(step.agentId, '\n' + '═'.repeat(80) + '\n');
    } catch (error) {
      // Update UI status to failed
      ui.updateAgentStatus(step.agentId, 'failed');

      console.error(
        formatAgentLog(
          step.agentId,
          `${step.agentName} failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      throw error;
    }
  }
  } finally {
    // Always cleanup UI on workflow end
    ui.stop();
  }
}
