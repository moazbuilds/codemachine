import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { Command } from 'commander';
import { createKeyboardController } from '../controllers/keyboard-controls.js';

import { orchestrateMasterMind } from '../../core/workflows/master-mind.js';
import { summarize } from '../../agents/runtime/project-summarizer.js';
import { retry } from '../../agents/runtime/retry.js';
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

async function allTasksDone(tasksPath: string): Promise<boolean> {
  const { tasks } = await loadTasks(tasksPath);
  return tasks.every((t) => t.done === true);
}

async function checkCodexHealth(cwd: string): Promise<boolean> {
  // Allow bypass in CI/tests
  if (process.env.SKIP_CODEX_HEALTH === '1') return true;
  try {
    const { spawn } = await import('node:child_process');

    // Try 'codex health' first, then fall back to '--version'
    const tryCmd = (cmd: string, args: string[]) =>
      new Promise<boolean>((resolve) => {
        const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'ignore', 'ignore'] });
        child.on('close', (code: number) => resolve(code === 0));
        child.on('error', () => resolve(false));
      });

    if (await tryCmd('codex', ['health'])) return true;
    if (await tryCmd('codex', ['--version'])) return true;
    return false;
  } catch {
    return false;
  }
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
    .description('RFC-2119-compliant Project Manager & Scrum Master orchestration')
    .option('--parallel', 'Allow parallel execution when dependencies permit', false)
    .option('--plain', 'Render plain logs (strip ANSI/padding)', false)
    .option('--tasks <path>', 'Override tasks.json path (relative to cwd)')
    .option('--logs <path>', 'Override logs file path (default .codemachine/logs.jsonl)')
    .action(async (options: PMOptions & { plain?: boolean }) => {
      const cwd = process.cwd();
      const tasksPath = options.tasks
        ? path.resolve(cwd, options.tasks)
        : (await fileExists(path.resolve(cwd, '.codemachine', 'plan', 'tasks.json')))
          ? path.resolve(cwd, '.codemachine', 'plan', 'tasks.json')
          : path.resolve(cwd, '.codemachine', 'tasks.json');
      const logsPath = options.logs ?? undefined;

      // Plain logs mode: helpful when terminals render padding oddly
      if (options.plain) {
        process.env.CODEMACHINE_PLAIN_LOGS = '1';
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

      // Preflight: ensure Codex API is reachable to avoid infinite loops
      const healthy = await checkCodexHealth(cwd);
      if (!healthy) {
        console.error('Codex API health check failed. Ensure the API server is running and CODEX_API_URL is set if needed.');
        process.exitCode = 1;
        return;
      }

      // Keyboard shortcuts: first Ctrl+C aborts current run; second exits
      const kb = createKeyboardController();
      const controller = new AbortController();
      const handleInterrupt = () => {
        if (!controller.signal.aborted) {
          console.log('\nInterrupted — stopping current Codex run. Press Ctrl+C again to exit.');
          controller.abort();
        } else {
          // Second interrupt => exit immediately with 130
          try { kb.stop(); } catch {}
          process.exit(130);
        }
      };
      kb.on('interrupt', handleInterrupt);
      kb.on('exit', () => {
        try { kb.stop(); } catch {}
        process.exit(130);
      });
      kb.start();

      process.once('SIGINT', handleInterrupt);

      // Orchestration with runtime agents: summarize after each pass and retry until done
      const summaryPath = path.resolve(cwd, '.codemachine', 'project-summary.md');
      let shouldContinue = true;
      while (shouldContinue) {
        shouldContinue = await retry({
          tasksPath,
          logsPath,
          orchestrate: async ({ tasksPath, logsPath }) => {
            await orchestrateMasterMind({
              parallel: Boolean(options.parallel),
              tasksPath,
              logsPath,
              cwd,
              abortSignal: controller.signal,
            });
            await summarize({ tasksPath, outputPath: summaryPath });
          },
        });

        // If aborted, stop looping
        if (controller.signal.aborted) break;
      }

      // Confirm completion banner from End agent
      const banner = await end({ tasksPath });
      if (banner && banner.trim().length > 0) console.log(banner);

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
      try { kb.stop(); } catch {}
    });
}
 
