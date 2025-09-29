import * as path from 'node:path';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';

import { end } from '../../../agents/runtime/end.js';
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

interface TaskRecord {
  id?: string;
  name?: string;
  done?: boolean;
  [key: string]: unknown;
}

export async function generateSummary(tasksPath: string, outputPath: string): Promise<void> {
  const contents = await readFile(tasksPath, 'utf8');
  const parsed = JSON.parse(contents) as { tasks?: TaskRecord[] };
  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  const completed = tasks.filter((t) => t.done === true);
  const remaining = tasks.filter((t) => t.done !== true);

  const lines: string[] = [];
  lines.push('# Project Summary');
  lines.push('');
  lines.push(`- Completed: ${completed.length}`);
  lines.push(`- Remaining: ${remaining.length}`);
  lines.push('');
  lines.push('## Completed Tasks');
  lines.push(...(completed.length ? completed.map((t) => `- [x] ${t.id ?? ''}: ${t.name ?? ''}`) : ['- None']));
  lines.push('');
  lines.push('## Remaining Tasks');
  lines.push(...(remaining.length ? remaining.map((t) => `- [ ] ${t.id ?? ''}: ${t.name ?? ''}`) : ['- None']));
  lines.push('');

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, lines.join('\n'), 'utf8');
}

async function runE2E(cwd: string): Promise<{ ok: boolean; output: string }> {
  const { spawn } = await import('node:child_process');
  const runners = [
    ['pnpm', ['test']],
    ['npm', ['test']],
    ['npx', ['vitest', 'run']],
  ] as const;

  for (const [cmd, args] of runners) {
    const result = await new Promise<{ ok: boolean; output: string }>((resolve) => {
      const child = spawn(cmd, args, { cwd });
      let out = '';
      let err = '';
      child.stdout?.on('data', (d: Buffer) => (out += d.toString()));
      child.stderr?.on('data', (d: Buffer) => (err += d.toString()));
      child.on('close', (code: number) => resolve({ ok: code === 0, output: out + (err ? `\n${err}` : '') }));
      child.on('error', () => resolve({ ok: false, output: out }));
    });
    if (result.ok) return result;
  }

  return { ok: false, output: 'No test runner succeeded.' };
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

async function runProjectManagerStep(cwd: string): Promise<void> {
  const tasksPath = await resolveTasksPath(cwd);
  if (tasksPath) {
    await generateSummary(tasksPath, path.resolve(cwd, '.codemachine', 'project-summary.md'));

    const banner = await end({ tasksPath });
    if (banner && banner.trim()) console.log(banner);
  }

  try {
    const e2e = await runE2E(cwd);
    const e2eFile = path.resolve(cwd, '.codemachine', 'e2e-results.txt');
    await mkdir(path.dirname(e2eFile), { recursive: true });
    await writeFile(
      e2eFile,
      [`E2E ok: ${e2e.ok}`, '', 'Output:', e2e.output.slice(0, 20000)].join('\n'),
      'utf8',
    );
    if (!e2e.ok) console.warn('End-to-end validation reported issues. See .codemachine/e2e-results.txt');
  } catch {
    // ignore e2e failures caused by missing tooling
  }
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
      } else if (agentName.includes('project manager')) {
        await runProjectManagerStep(cwd);
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
