import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { runCodex } from '../../infra/codex/codex-runner.js';
import { runAgentsBuilder } from '../../agents/runtime/agents-builder.js';
import { runPlanningWorkflow } from './planning-workflow.js';
import { orchestrateMasterMind } from './master-mind.js';
import { summarize } from '../../agents/runtime/project-summarizer.js';
import { end } from '../../agents/runtime/end.js';

type UnknownRecord = Record<string, unknown>;

export type WorkflowStep =
  | {
      type: 'prompt';
      name?: string;
      agent: string; // profile id from inputs/agents.js
      promptPath: string; // absolute or relative to project root
    }
  | {
      type: 'module';
      module:
        | 'agents-builder'
        | 'planning-workflow'
        | 'project-manager';
      options?: UnknownRecord;
    };

export type WorkflowTemplate = WorkflowStep[];

export interface RunWorkflowQueueOptions {
  cwd?: string;
  templatePath?: string; // custom template JS path; if absent, loads default
  force?: boolean;
  specificationPath?: string; // used by agents-builder and planning-workflow
}

async function readText(filePath: string): Promise<string> {
  return readFile(filePath, 'utf8');
}

async function loadTemplate(cwd: string, templatePath?: string): Promise<WorkflowTemplate> {
  const candidates = [
    templatePath && path.resolve(cwd, templatePath),
    path.resolve(cwd, '.codemachine', 'workflow.template.js'),
    path.resolve(cwd, 'templates', 'workflows', 'default.workflow.js'),
  ].filter(Boolean) as string[];

  for (const modPath of candidates) {
    try {
      const tpl = (await loadWorkflowModule(modPath)) as unknown;
      if (Array.isArray(tpl)) return tpl as WorkflowTemplate;
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    `No workflow template found. Looked for: ${candidates
      .map((p) => path.relative(cwd, p))
      .join(', ')}`,
  );
}

async function loadWorkflowModule(modPath: string): Promise<unknown> {
  const ext = path.extname(modPath).toLowerCase();
  if (ext === '.cjs' || ext === '.cts') {
    const require = createRequire(import.meta.url);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      delete require.cache[require.resolve(modPath)];
    } catch {}
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(modPath);
  }

  const fileUrl = pathToFileURL(modPath);
  const cacheBustingUrl = new URL(fileUrl.href);
  cacheBustingUrl.searchParams.set('ts', Date.now().toString());
  const mod = await import(cacheBustingUrl.href);
  return mod?.default ?? mod;
}

async function runPromptStep(step: Extract<WorkflowStep, { type: 'prompt' }>, cwd: string): Promise<void> {
  const promptFile = path.isAbsolute(step.promptPath)
    ? step.promptPath
    : path.resolve(cwd, step.promptPath);
  const content = await readText(promptFile);
  const title = step.name ? `\n\n[${step.name}]\n\n` : '\n\n';
  await runCodex({
    profile: step.agent,
    prompt: `${content}${title}`,
    workingDir: cwd,
    onData: (chunk) => {
      try { process.stdout.write(chunk); } catch {}
    },
    onErrorData: (chunk) => {
      try { process.stderr.write(chunk); } catch {}
    },
  });
}

async function allTasksDone(tasksPath: string): Promise<boolean> {
  try {
    const json = JSON.parse(await readText(tasksPath)) as { tasks?: { done?: boolean }[] };
    const tasks = Array.isArray(json.tasks) ? json.tasks : [];
    return tasks.length > 0 && tasks.every((t) => t.done === true);
  } catch {
    return false;
  }
}

export async function runWorkflowQueue(options: RunWorkflowQueueOptions = {}): Promise<void> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const template = await loadTemplate(cwd, options.templatePath);

  for (const step of template) {
    if (step.type === 'prompt') {
      await runPromptStep(step, cwd);
      continue;
    }

    if (step.type === 'module') {
      switch (step.module) {
        case 'agents-builder': {
          await runAgentsBuilder({
            workingDir: cwd,
            force: Boolean(options.force),
            specPath: options.specificationPath,
          });
          break;
        }
        case 'planning-workflow': {
          await runPlanningWorkflow({
            force: Boolean(options.force),
            specificationPath: options.specificationPath || path.resolve(cwd, 'runner-prompts', 'user-input.md'),
          });
          break;
        }
        case 'project-manager': {
          // Drive MasterMind until all tasks are done, with summary pass
          const tasksPath = path.resolve(
            cwd,
            (await import('node:fs')).existsSync(path.resolve(cwd, '.codemachine', 'plan', 'tasks.json'))
              ? path.join('.codemachine', 'plan', 'tasks.json')
              : path.join('.codemachine', 'tasks.json'),
          );

          let guard = 0;
          while (!(await allTasksDone(tasksPath)) && guard < 10) {
            await orchestrateMasterMind({ cwd });
            await summarize({ tasksPath, outputPath: path.resolve(cwd, '.codemachine', 'project-summary.md') });
            guard += 1;
          }

          // Final banner
          try {
            const banner = await end({ tasksPath });
            if (banner && banner.trim()) console.log(banner);
          } catch {}

          // Run end-to-end tests (same heuristics as project-manager command)
          try {
            const { spawn } = await import('node:child_process');
            const tryRun = (cmd: string, args: string[]) =>
              new Promise<{ ok: boolean; out: string }>((resolve) => {
                const child = spawn(cmd, args, { cwd });
                let out = '';
                let err = '';
                child.stdout?.on('data', (d: Buffer) => (out += d.toString()));
                child.stderr?.on('data', (d: Buffer) => (err += d.toString()));
                child.on('close', (code: number) => resolve({ ok: code === 0, out: out + (err ? `\n${err}` : '') }));
                child.on('error', () => resolve({ ok: false, out }));
              });
            const runners = [
              ['pnpm', ['test']],
              ['npm', ['test']],
              ['npx', ['vitest', 'run']],
            ] as const;
            let passed = false;
            let output = '';
            for (const [cmd, args] of runners) {
              const r = await tryRun(cmd, args);
              output = r.out;
              if (r.ok) { passed = true; break; }
            }
            const e2eFile = path.resolve(cwd, '.codemachine', 'e2e-results.txt');
            const { mkdir, writeFile } = await import('node:fs/promises');
            await mkdir(path.dirname(e2eFile), { recursive: true });
            await writeFile(e2eFile, [`E2E ok: ${passed}`, '', 'Output:', output.slice(0, 20000)].join('\n'), 'utf8');
            if (!passed) console.warn('End-to-end validation reported issues. See .codemachine/e2e-results.txt');
          } catch {}
          break;
        }
        default:
          throw new Error(`Unknown module step: ${(step as { module?: string }).module}`);
      }
      continue;
    }
  }
}

export default runWorkflowQueue;
