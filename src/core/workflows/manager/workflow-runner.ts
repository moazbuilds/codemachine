import * as path from 'node:path';
import { access, readFile } from 'node:fs/promises';

import type { RunWorkflowOptions } from './types.js';
import { loadTemplate } from './template-loader.js';
import { runCodexPrompt } from './agent-execution.js';
import { syncCodexConfig } from '../../../app/services/config-sync.js';
import { ensureProjectScaffold } from './workspace-prep.js';
import { validateSpecification } from './validation.js';
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

async function runPlanningStep(cwd: string, options: RunWorkflowOptions): Promise<void> {
  await validateSpecification(
    options.specificationPath || path.resolve(cwd, '.codemachine', 'inputs', 'specifications.md'),
    options.force,
  );
}

export async function runWorkflow(options: RunWorkflowOptions = {}): Promise<void> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const template = await loadTemplate(cwd, options.templatePath);

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

  for (const step of template.steps) {
    if (step.type !== 'module') continue;

    console.log(`${step.agentName} started to work.`);

    try {
      const promptPath = path.isAbsolute(step.promptPath)
        ? step.promptPath
        : path.resolve(cwd, step.promptPath);
      const prompt = await readFile(promptPath, 'utf8');
      await runCodexPrompt({ agentId: step.agentId, prompt, cwd });

      const agentName = step.agentName.toLowerCase();

      if (step.agentId === 'agents-builder' || agentName.includes('builder')) {
        await runAgentsBuilderStep(cwd);
      } else {
        await runPlanningStep(cwd, options);
      }

      console.log(`${step.agentName} has completed their work.`);
    } catch (error) {
      console.error(`${step.agentName} failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
