import { promises as fs } from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

import { runCodex } from '../../infra/codex/codex-runner.js';
import { MemoryAdapter } from '../../infra/fs/memory-adapter.js';
import { MemoryStore } from '../../agents/memory/memory-store.js';
import type { Phase } from './phase-map.js';

type UnknownRecord = Record<string, unknown>;

export interface MasterMindOptions {
  parallel?: boolean;
  tasksPath?: string; // defaults to .codemachine/plan/tasks.json then fallback .codemachine/tasks.json
  logsPath?: string; // defaults to .codemachine/logs.jsonl
  cwd?: string; // working directory for command execution
  execute?: (agentId: string, prompt: string) => Promise<string>; // injectable executor for tests, returns stdout
  abortSignal?: AbortSignal; // allows Ctrl+C to cancel current Codex run and stop orchestration
}

interface TaskItem {
  id: string;
  name: string;
  phase: Phase | string;
  details?: string;
  acceptanceCriteria?: string;
  done?: boolean;
  dependsOn?: string[];
  // Allow additional fields without typing them all
  [key: string]: unknown;
}

interface TasksFile {
  tasks: TaskItem[];
}

type LogRecord = {
  timestamp: string;
  taskId: string;
  taskName: string;
  phase: string;
  agent: string;
  durationMs: number;
  outcome: 'success' | 'skipped' | 'failed';
  message?: string;
};

const DEFAULT_LOGS_PATH = path.join('.codemachine', 'logs.jsonl');

async function fileExists(p: string): Promise<boolean> {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function resolveTasksPath(cwd: string, override?: string): Promise<string> {
  if (override) return path.resolve(cwd, override);
  const planPath = path.resolve(cwd, '.codemachine', 'plan', 'tasks.json');
  if (await fileExists(planPath)) return planPath;
  const rootPath = path.resolve(cwd, '.codemachine', 'tasks.json');
  return rootPath;
}

function selectAgentForTask(task: TaskItem): string {
  const phase = String(task.phase);
  const details = `${task.name}\n${task.details ?? ''}`.toLowerCase();

  if (phase === 'Planning') {
    if (details.includes('doc') || details.includes('write') || details.includes('documentation')) {
      return 'technical-writer';
    }
    return 'software-architect';
  }

  if (phase === 'Building') {
    // Heuristic: prefer frontend for UI/public files, else backend
    if (details.includes('frontend') || details.includes('ui') || details.includes('public/') || details.includes('src/client') || details.includes('src/frontend')) {
      return 'frontend-dev';
    }
    return 'backend-dev';
  }

  if (phase === 'Testing') return 'qa-engineer';
  if (phase === 'Runtime') return 'performance-engineer';
  // Fallback
  return 'backend-dev';
}

function buildTaskPrompt(task: TaskItem): string {
  const nn = '\n\n';
  const acceptance = task.acceptanceCriteria ? `Acceptance: ${task.acceptanceCriteria}` : '';
  return `${task.name}${nn}${task.details ?? ''}${nn}${acceptance}`.trim();
}

async function runAgent(agentId: string, prompt: string, cwd: string, abortSignal?: AbortSignal): Promise<string> {
  // Compose a simple wrapped prompt; stream output to mirror Codex logs
  let buffered = '';
  const result = await runCodex({
    profile: agentId,
    prompt,
    workingDir: cwd,
    abortSignal,
    onData: (chunk) => {
      buffered += chunk;
      try {
        process.stdout.write(chunk);
      } catch {
        // ignore streaming failures in CI
      }
    },
    onErrorData: (chunk) => {
      try {
        process.stderr.write(chunk);
      } catch {
        // ignore streaming failures in CI
      }
    },
  });
  const stdout = result.stdout || buffered;
  try {
    const memoryDir = path.resolve(cwd, 'memory');
    const adapter = new MemoryAdapter(memoryDir);
    const store = new MemoryStore(adapter);
    const slice = stdout.slice(-2000);
    await store.append({ agentId, content: slice, timestamp: new Date().toISOString() });
  } catch {
    // best-effort memory persistence
  }
  return stdout;
}

function extractVerificationCommands(text: string): string[] {
  // Very small parser: find section starting with '### Verification' and collect commands inside backticks
  const lines = text.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => l.trim().toLowerCase().startsWith('### verification'));
  if (startIdx === -1) return [];
  const cmds: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('### ')) break;
    const backtickMatches = [...line.matchAll(/`([^`]+)`/g)];
    for (const m of backtickMatches) {
      const cmd = m[1].trim();
      if (cmd) cmds.push(cmd);
    }
  }
  return cmds;
}

interface VerificationResult { ok: boolean; failedCommand?: string }

async function verifyTask(task: TaskItem, cwd: string): Promise<VerificationResult> {
  const detailText = task.details ?? '';
  const commands = extractVerificationCommands(detailText);
  if (commands.length === 0) {
    // No explicit verification; accept conservatively as false to avoid false positives
    return { ok: false };
  }

  for (const cmd of commands) {
    // Minimal support: allow `test -f <path>` and ripgrep `rg` commands, and generic shell
    const ok = await new Promise<boolean>((resolve) => {
      const { spawn } = require('node:child_process');
      const child = spawn('bash', ['-lc', cmd], { cwd });
      child.on('close', (code: number) => resolve(code === 0));
      child.on('error', () => resolve(false));
    });
    if (!ok) return { ok: false, failedCommand: cmd };
  }

  return { ok: true };
}

async function appendLog(logsPath: string, record: LogRecord): Promise<void> {
  const dir = path.dirname(logsPath);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.appendFile(logsPath, JSON.stringify(record) + '\n', { encoding: 'utf8' });
}

function topologicalOrder(tasks: TaskItem[]): TaskItem[] {
  const byId = new Map(tasks.map((t) => [t.id, t] as const));
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const t of tasks) {
    const deps = Array.isArray(t.dependsOn) ? t.dependsOn : [];
    inDegree.set(t.id, deps.length);
    for (const d of deps) {
      if (!graph.has(d)) graph.set(d, []);
      graph.get(d)!.push(t.id);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) if (deg === 0) queue.push(id);
  const ordered: TaskItem[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    const node = byId.get(id);
    if (node) ordered.push(node);
    const nbrs = graph.get(id) ?? [];
    for (const n of nbrs) {
      inDegree.set(n, (inDegree.get(n) ?? 0) - 1);
      if ((inDegree.get(n) ?? 0) === 0) queue.push(n);
    }
  }
  // Fallback: append any tasks not visited (cycles) in original order
  if (ordered.length !== tasks.length) {
    const seen = new Set(ordered.map((t) => t.id));
    for (const t of tasks) if (!seen.has(t.id)) ordered.push(t);
  }
  return ordered;
}

async function loadTasks(tasksPath: string): Promise<TasksFile> {
  const contents = await fsp.readFile(tasksPath, 'utf8');
  const parsed = JSON.parse(contents) as UnknownRecord;
  const arr = Array.isArray(parsed.tasks) ? (parsed.tasks as UnknownRecord[]) : [];
  const tasks: TaskItem[] = arr.map((t) => ({ ...t })) as TaskItem[];
  return { tasks };
}

async function saveTasks(tasksPath: string, tasks: TaskItem[]): Promise<void> {
  const contents = JSON.stringify({ tasks }, null, 2) + '\n';
  await fsp.writeFile(tasksPath, contents, 'utf8');
}

export async function orchestrateMasterMind(options: MasterMindOptions = {}): Promise<void> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const tasksPath = await resolveTasksPath(cwd, options.tasksPath);
  const logsPath = options.logsPath ? path.resolve(cwd, options.logsPath) : path.resolve(cwd, DEFAULT_LOGS_PATH);
  const parallel = options.parallel ?? false;
  const abortSignal = options.abortSignal;

  const execFn = options.execute ?? (async (agentId: string, prompt: string) => runAgent(agentId, prompt, cwd, abortSignal));

  // Preload context inputs (optional)
  const planPath1 = path.resolve(cwd, '.codemachine', 'plan.md');
  const planPath2 = path.resolve(cwd, '.codemachine', 'plan', 'plan.md');
  const userReqPath = path.resolve(cwd, 'input-user.md');
  const agentsUsagePath = path.resolve(cwd, 'inputs', 'agents-usage.md');
  const ctx = {
    plan: await (async () => {
      for (const p of [planPath1, planPath2]) if (await fileExists(p)) return fsp.readFile(p, 'utf8');
      return '';
    })(),
    user: (await fileExists(userReqPath)) ? await fsp.readFile(userReqPath, 'utf8') : '',
    usage: (await fileExists(agentsUsagePath)) ? await fsp.readFile(agentsUsagePath, 'utf8') : '',
  };

  let progress = true;
  while (progress) {
    if (abortSignal?.aborted) break;
    progress = false;
    const snapshot = await loadTasks(tasksPath);
    const ordered = topologicalOrder(snapshot.tasks);

    for (const task of ordered) {
      if (abortSignal?.aborted) break;
      if (task.done) continue;

      const deps = Array.isArray(task.dependsOn) ? task.dependsOn : [];
      const depsDone = deps.every((id) => ordered.find((t) => t.id === id)?.done === true);
      if (!depsDone) continue;

      const agentPrimary = selectAgentForTask(task);
      const agentFallbacks: string[] = (() => {
        const phase = String(task.phase);
        const details = `${task.name}\n${task.details ?? ''}`.toLowerCase();
        if (phase === 'Planning') return ['solution-architect', 'technical-writer'];
        if (phase === 'Building') {
          const isFrontend =
            details.includes('frontend') ||
            details.includes('ui') ||
            details.includes('public/') ||
            details.includes('src/client') ||
            details.includes('src/frontend');
          return isFrontend ? ['backend-dev'] : ['frontend-dev'];
        }
        if (phase === 'Testing') return ['backend-dev'];
        if (phase === 'Runtime') return ['backend-dev'];
        return ['software-architect'];
      })();

      const basePrompt = buildTaskPrompt(task);
      const guidance: string[] = [
        'You are a specialized implementation agent in a multi-agent system.',
        'Follow the task details precisely and produce concrete changes in the workspace.',
        'MUST NOT alter unrelated files. Keep diffs minimal and focused.',
        'When you introduce or change context, update memory files under `memory/` accordingly.',
        ctx.user ? `User requirements (excerpt)\n---\n${(await ctx.user).slice(0, 1500)}` : '',
        ctx.plan ? `Project plan (excerpt)\n---\n${(await ctx.plan).slice(0, 1500)}` : '',
        ctx.usage ? `Agent CLI usage (excerpt)\n---\n${(await ctx.usage).slice(0, 1000)}` : '',
      ].filter(Boolean) as string[];
      const prompt = `${basePrompt}\n\n---\nSystem Guidance:\n${guidance.join('\n\n')}`;

      const start = Date.now();
      try {
        if (abortSignal?.aborted) break;
        await appendLog(logsPath, {
          timestamp: new Date().toISOString(),
          taskId: task.id,
          taskName: task.name,
          phase: String(task.phase),
          agent: agentPrimary,
          durationMs: 0,
          outcome: 'skipped',
          message: 'phase:start',
        });

        // Attempt execution + verification up to 3 times per agent; then try fallbacks
        const candidates = [agentPrimary, ...agentFallbacks];
        let verify: VerificationResult = { ok: false };
        let attemptsTotal = Number((task as UnknownRecord).attempts ?? 0);
        let usedAgent = candidates[0];

        for (const agentId of candidates) {
          usedAgent = agentId;
          let attempts = 0;
          while (attempts < 3) {
            if (abortSignal?.aborted) break;
            await execFn(agentId, prompt);
            verify = await verifyTask(task, cwd);
            attempts += 1;
            attemptsTotal += 1;

            // persist attempt counter to tasks.json
            const currentAttempt = await loadTasks(tasksPath);
            const entry = currentAttempt.tasks.find((t) => t.id === task.id) as UnknownRecord | undefined;
            if (entry) {
              (entry as UnknownRecord).attempts = attemptsTotal;
              await saveTasks(tasksPath, currentAttempt.tasks);
            }

            if (verify.ok) break;

            const deficiency = verify.failedCommand
              ? `The following verification command failed: ${verify.failedCommand}`
              : 'Verification failed against acceptance criteria.';
            const acceptance = task.acceptanceCriteria ? `\n\nAcceptance criteria:\n${task.acceptanceCriteria}` : '';
            const remediation = [
              `Your previous output for task "${task.name}" did not pass verification.`,
              deficiency,
              acceptance,
              ctx.user ? `\n\nUser requirements (excerpt):\n${(await ctx.user).slice(0, 1500)}` : '',
              ctx.plan ? `\n\nProject plan (excerpt):\n${(await ctx.plan).slice(0, 1500)}` : '',
            ]
              .filter(Boolean)
              .join('\n');

            const followUp = `${prompt}\n\n---\nFollow-up instructions:\n${remediation}\n\nEnsure that verification passes.`;
            if (abortSignal?.aborted) break;
            await execFn(agentId, followUp);
            verify = await verifyTask(task, cwd);
            if (verify.ok) break;
          }
          if (verify.ok) break;
        }
        const durationMs = Date.now() - start;

        if (verify.ok) {
          // Persist done status
          const current = await loadTasks(tasksPath);
          const match = current.tasks.find((t) => t.id === task.id);
          if (match) match.done = true;
          await saveTasks(tasksPath, current.tasks);
          await appendLog(logsPath, {
            timestamp: new Date().toISOString(),
            taskId: task.id,
            taskName: task.name,
            phase: String(task.phase),
            agent: usedAgent,
            durationMs,
            outcome: 'success',
            message: 'phase:complete',
          });

          if (String(task.phase) !== 'Testing') {
            await appendLog(logsPath, {
              timestamp: new Date().toISOString(),
              taskId: task.id,
              taskName: task.name,
              phase: 'Testing',
              agent: 'qa-engineer',
              durationMs: 0,
              outcome: 'success',
              message: 'qa:triggered',
            });
          }

          progress = true;
          if (!parallel) break; // process one, then rescan
        } else {
          await appendLog(logsPath, {
            timestamp: new Date().toISOString(),
            taskId: task.id,
            taskName: task.name,
            phase: String(task.phase),
            agent: usedAgent,
            durationMs,
            outcome: 'failed',
            message: 'verification:failed',
          });
        }
      } catch (error) {
        const durationMs = Date.now() - start;
        await appendLog(logsPath, {
          timestamp: new Date().toISOString(),
          taskId: task.id,
          taskName: task.name,
          phase: String(task.phase),
          agent: agentPrimary,
          durationMs,
          outcome: 'failed',
          message: error instanceof Error ? error.message : 'execution error',
        });
      }
    }
  }
}

export default orchestrateMasterMind;
