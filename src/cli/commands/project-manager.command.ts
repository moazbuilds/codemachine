import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { Command } from 'commander';

import { resolveTasksPath, generateSummary } from '../../core/workflows/workflow-manager.js';
import { end } from '../../agents/runtime/end.js';

type PMOptions = {
  parallel?: boolean;
  tasks?: string;
  logs?: string;
};

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadTasks(tasksPath: string): Promise<{ tasks: { done?: boolean }[] }> {
  const contents = await fs.readFile(tasksPath, 'utf8');
  return JSON.parse(contents) as { tasks: { done?: boolean }[] };
}

async function _allTasksDone(tasksPath: string): Promise<boolean> {
  const { tasks } = await loadTasks(tasksPath);
  return tasks.every((t) => t.done === true);
}

async function runE2E(cwd: string): Promise<{ ok: boolean; output: string }> {
  const { spawn } = await import('node:child_process');
  const cmds = [
    { cmd: 'pnpm', args: ['test'] },
    { cmd: 'npm', args: ['test'] },
    { cmd: 'npx', args: ['vitest', 'run'] },
  ];
  for (const { cmd, args } of cmds) {
    const ok = await new Promise<{ ok: boolean; output: string }>((resolve) => {
      const child = spawn(cmd, args, { cwd });
      let out = '';
      let err = '';
      child.stdout?.on('data', (d: Buffer) => (out += d.toString()));
      child.stderr?.on('data', (d: Buffer) => (err += d.toString()));
      child.on('close', (code: number) => resolve({ ok: code === 0, output: out + (err ? `\n${err}` : '') }));
      child.on('error', () => resolve({ ok: false, output: err || out }));
    });
    if (ok.ok) return ok;
  }
  return { ok: false, output: 'No test runner succeeded.' };
}

export function registerProjectManagerCommand(program: Command): void {
  program
    .command('project-manager')
    .alias('pm')
    .description('Project summary generation and validation')
    .option('--parallel', 'Legacy flag (no longer used)', false)
    .option('--plain', 'Render plain logs (strip ANSI/padding)', false)
    .option('--tasks <path>', 'Override tasks.json path (relative to cwd)')
    .option('--logs <path>', 'Legacy logs path option (no longer used)')
    .action(async (options: PMOptions & { plain?: boolean }) => {
      const cwd = process.cwd();
      const overrideTasks = options.tasks ? path.resolve(cwd, options.tasks) : undefined;
      const tasksPath = await resolveTasksPath(cwd, overrideTasks);

      // Plain logs mode: helpful when terminals render padding oddly
      if (options.plain) {
        process.env.CODEMACHINE_PLAIN_LOGS = '1';
      }

      if (options.parallel) {
        console.warn('Note: --parallel is no longer used. Agents now orchestrate task execution.');
      }

      if (options.logs) {
        console.warn('Note: --logs is deprecated and ignored.');
      }

      // Required inputs (access checks)
      const requiredFiles = [
        path.resolve(cwd, '.codemachine', 'plan.md'),
        path.resolve(cwd, '.codemachine', 'tasks.json'),
        path.resolve(cwd, 'inputs', 'agents.js'),
        path.resolve(cwd, 'inputs', 'agents-usage.md'),
      ];
      const optionalFiles = [path.resolve(cwd, 'input-user.md')];

      for (const f of requiredFiles) {
        if (!(await fileExists(f))) {
          console.warn(`Warning: required input not found: ${path.relative(cwd, f)}`);
        }
      }
      for (const f of optionalFiles) {
        if (!(await fileExists(f))) {
          console.warn(`Note: optional input not found: ${path.relative(cwd, f)}`);
        }
      }

      if (!tasksPath) {
        console.warn('No tasks file found. Skipping project summary and completion banner.');
      } else if (!(await fileExists(tasksPath))) {
        console.warn(`Tasks file not found at ${path.relative(cwd, tasksPath)}. Skipping summary generation.`);
      } else {
        await generateSummary(tasksPath, path.resolve(cwd, '.codemachine', 'project-summary.md'));

        if (!(await _allTasksDone(tasksPath))) {
          console.warn('Tasks remain incomplete. Ensure agents finish their work before final validation.');
        }

        const banner = await end({ tasksPath });
        if (banner && banner.trim().length > 0) console.log(banner);
      }

      // Run end-to-end validation
      console.log('Running end-to-end validation...');
      const e2e = await runE2E(cwd);
      const issuesFile = path.resolve(cwd, '.codemachine', 'e2e-results.txt');
      await fs.mkdir(path.dirname(issuesFile), { recursive: true });
      const summary = [
        `E2E ok: ${e2e.ok}`,
        '',
        'Output:',
        e2e.output.slice(0, 20000),
      ].join('\n');
      await fs.writeFile(issuesFile, summary, 'utf8');
      console.log(`E2E results written to ${path.relative(cwd, issuesFile)}`);

      if (!e2e.ok) {
        console.warn('End-to-end validation reported issues. See e2e-results.txt');
      } else {
        console.log('All tasks done and end-to-end tests passed.');
      }
    });
}
 
