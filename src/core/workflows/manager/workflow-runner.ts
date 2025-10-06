import * as path from 'node:path';
import { access, readFile } from 'node:fs/promises';
import chalk from 'chalk';

import type { RunWorkflowOptions } from './types.js';
import { loadTemplateWithPath } from './template-loader.js';
import { runAgent } from './agent-execution.js';
import { syncCodexConfig } from '../../../app/services/backends/codex/config-sync.js';
import { ensureProjectScaffold } from './workspace-prep.js';
import { processPromptString } from './prompt-processor.js';
import { evaluateLoopBehavior } from '../modules/loop-behavior.js';
import { getAgentLoggers, formatAgentLog } from './agent-loggers.js';
import {
  getTemplatePathFromTracking,
  getCompletedSteps,
  markStepCompleted,
} from '../../../shared/agents/template-tracking.js';
const TASKS_PRIMARY_PATH = path.join('.codemachine', 'plan', 'tasks.json');
const TASKS_FALLBACK_PATH = path.join('.codemachine', 'tasks.json');

export async function resolveTasksPath(cwd: string, override?: string): Promise<string | null> {
  if (override) return path.resolve(cwd, override);
  const candidates = [TASKS_PRIMARY_PATH, TASKS_FALLBACK_PATH].map((p) => path.resolve(cwd, p));
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // ignore missing candidate
    }
  }
  return null;
}

async function runAgentsBuilderStep(cwd: string): Promise<void> {
  await ensureProjectScaffold(cwd);
}

export async function runWorkflow(options: RunWorkflowOptions = {}): Promise<void> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();

  // Load template from .codemachine/template.json or use provided path
  const cmRoot = path.join(cwd, '.codemachine');
  const templatePath = options.templatePath || await getTemplatePathFromTracking(cmRoot);

  const { template } = await loadTemplateWithPath(cwd, templatePath);

  console.log(`Using workflow template: ${template.name}`);

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

  if (workflowAgents.length > 0) {
    await syncCodexConfig({ additionalAgents: workflowAgents });
  }

  // Load completed steps for executeOnce tracking
  const completedSteps = await getCompletedSteps(cmRoot);

  const loopCounters = new Map<string, number>();
  let activeLoop: { skip: string[] } | null = null;

  for (let index = 0; index < template.steps.length; index += 1) {
    const step = template.steps[index];
    if (step.type !== 'module') {
      continue;
    }

    // Skip step if executeOnce is true and it's already completed
    if (step.executeOnce && completedSteps.includes(index)) {
      console.log(formatAgentLog(step.agentId, `${step.agentName} skipped (already completed).`));
      continue;
    }

    // Skip step if it's in the active loop's skip list
    if (activeLoop?.skip.includes(step.agentId)) {
      console.log(formatAgentLog(step.agentId, `${step.agentName} skipped (loop configuration).`));
      continue;
    }

    if (process.env.CODEMACHINE_DEBUG_LOOPS === '1' && activeLoop) {
      console.log(
        formatAgentLog(
          step.agentId,
          `[skip-check] agentId=${step.agentId} skipList=[${activeLoop.skip.join(', ')}] shouldSkip=${activeLoop.skip.includes(step.agentId)}`,
        ),
      );
    }

    console.log('═'.repeat(80));
    console.log(formatAgentLog(step.agentId, `${step.agentName} started to work.`));

    // Status indicator with spinner
    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIndex = 0;
    let lastOutputTime = Date.now();
    let spinnerActive = false;

    // Wrap loggers to track output and clear spinner
    const { stdout: baseStdoutLogger, stderr: baseStderrLogger } = getAgentLoggers(step.agentId);
    const stdoutLogger = (chunk: string) => {
      if (spinnerActive) {
        process.stdout.write('\r' + ' '.repeat(100) + '\r');
        spinnerActive = false;
      }
      lastOutputTime = Date.now();
      baseStdoutLogger(chunk);
    };
    const stderrLogger = (chunk: string) => {
      if (spinnerActive) {
        process.stdout.write('\r' + ' '.repeat(100) + '\r');
        spinnerActive = false;
      }
      lastOutputTime = Date.now();
      baseStderrLogger(chunk);
    };

    const statusInterval = setInterval(() => {
      const timeSinceLastOutput = Date.now() - lastOutputTime;
      // Only show spinner if no output for 2 seconds
      if (timeSinceLastOutput > 2000) {
        const spinner = spinnerChars[spinnerIndex % spinnerChars.length];
        // Special color for status indicator - dim yellow/orange
        process.stdout.write('\r' + chalk.hex('#FFA500')(`${spinner} ${step.agentName} is running...`));
        spinnerActive = true;
        spinnerIndex++;
      }
    }, 100);

    try {
      const promptPath = path.isAbsolute(step.promptPath)
        ? step.promptPath
        : path.resolve(cwd, step.promptPath);
      const rawPrompt = await readFile(promptPath, 'utf8');
      const prompt = await processPromptString(rawPrompt, cwd);

      // Use environment variable or default to 10 minutes (600000ms)
      const timeout = process.env.CODEMACHINE_AGENT_TIMEOUT
        ? Number.parseInt(process.env.CODEMACHINE_AGENT_TIMEOUT, 10)
        : 600000;

      const output = await runAgent(step.agentId, prompt, cwd, {
        logger: stdoutLogger,
        stderrLogger,
        timeout,
      });

      const agentName = step.agentName.toLowerCase();

      if (step.agentId === 'agents-builder' || agentName.includes('builder')) {
        await runAgentsBuilderStep(cwd);
      }

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

        // Set active loop with skip list
        activeLoop = { skip: step.module?.behavior?.skip ?? [] };

        const skipInfo = activeLoop.skip.length > 0
          ? ` (skipping: ${activeLoop.skip.join(', ')})`
          : '';
        clearInterval(statusInterval);
        process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the status line
        console.log(
          formatAgentLog(
            step.agentId,
            `${step.agentName} triggered a loop (match: ${step.module?.behavior?.trigger}); ` +
              `repeating previous step. Iteration ${nextIterationCount}${
                step.module?.behavior?.maxIterations
                  ? `/${step.module.behavior.maxIterations}`
                  : ''
              }${skipInfo}.`,
          ),
        );
        index = rewindIndex;
        continue;
      }

      if (loopDecision?.reason) {
        console.log(formatAgentLog(step.agentId, `${step.agentName} loop skipped: ${loopDecision.reason}.`));
      }

      // Clear active loop only when a loop step explicitly terminates (shouldRepeat=false)
      if (loopDecision !== null && !loopDecision.shouldRepeat) {
        activeLoop = null;
        loopCounters.set(loopKey, 0);
      }

      clearInterval(statusInterval);
      process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the status line

      // Mark step as completed if executeOnce is true
      if (step.executeOnce) {
        await markStepCompleted(cmRoot, index);
      }

      console.log(formatAgentLog(step.agentId, `${step.agentName} has completed their work.`));
      console.log('\n' + '═'.repeat(80) + '\n');
    } catch (error) {
      clearInterval(statusInterval);
      process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the status line
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
