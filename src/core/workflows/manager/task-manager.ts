import * as path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

import type { TaskManagerOptions } from './types.js';
import { runAgent } from './agent-execution.js';

interface TaskItem {
  id: string;
  name: string;
  phase: string;
  details?: string;
  acceptanceCriteria?: string;
  done?: boolean;
  dependsOn?: string[];
  [key: string]: unknown;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    const { access } = await import('node:fs/promises');
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function resolveTasksPath(cwd: string, override?: string): Promise<string> {
  if (override) return path.resolve(cwd, override);
  const planPath = path.resolve(cwd, '.codemachine', 'plan', 'tasks.json');
  if (await fileExists(planPath)) return planPath;
  return path.resolve(cwd, '.codemachine', 'tasks.json');
}

function selectAgentForTask(task: TaskItem): string {
  const phase = String(task.phase);
  const details = `${task.name}\n${task.details ?? ''}`.toLowerCase();

  if (phase === 'Planning') return 'master-mind';
  if (phase === 'Building') {
    if (details.includes('frontend') || details.includes('ui')) return 'frontend-dev';
    return 'backend-dev';
  }
  if (phase === 'Testing') return 'qa-engineer';
  if (phase === 'Runtime') return 'performance-engineer';
  return 'master-mind';
}

function buildTaskPrompt(task: TaskItem): string {
  const acceptance = task.acceptanceCriteria ? `\n\nAcceptance: ${task.acceptanceCriteria}` : '';
  return `${task.name}\n\n${task.details ?? ''}${acceptance}`.trim();
}

function extractVerificationCommands(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => l.trim().toLowerCase().startsWith('### verification'));
  if (startIdx === -1) return [];
  const cmds: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('### ')) break;
    const matches = [...line.matchAll(/`([^`]+)`/g)];
    for (const match of matches) {
      const cmd = match[1].trim();
      if (cmd) cmds.push(cmd);
    }
  }
  return cmds;
}

async function verifyTask(task: TaskItem, cwd: string): Promise<{ ok: boolean; failedCommand?: string }> {
  const commands = extractVerificationCommands(task.details ?? '');
  if (commands.length === 0) return { ok: false };

  for (const cmd of commands) {
    const ok = await new Promise<boolean>((resolve) => {
      // spawn is imported at the top
      const child = spawn('bash', ['-lc', cmd], { cwd });
      child.on('close', (code: number) => resolve(code === 0));
      child.on('error', () => resolve(false));
    });
    if (!ok) return { ok: false, failedCommand: cmd };
  }

  return { ok: true };
}

async function appendLog(logsPath: string, record: Record<string, unknown>): Promise<void> {
  const dir = path.dirname(logsPath);
  await mkdir(dir, { recursive: true });
  await writeFile(logsPath, JSON.stringify(record) + '\n', { flag: 'a', encoding: 'utf8' });
}

function topologicalOrder(tasks: TaskItem[]): TaskItem[] {
  const byId = new Map(tasks.map((t) => [t.id, t] as const));
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const task of tasks) {
    const deps = Array.isArray(task.dependsOn) ? task.dependsOn : [];
    inDegree.set(task.id, deps.length);
    for (const d of deps) {
      if (!graph.has(d)) graph.set(d, []);
      graph.get(d)!.push(task.id);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) if (deg === 0) queue.push(id);
  const ordered: TaskItem[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    const node = byId.get(id);
    if (node) ordered.push(node);
    const neighbours = graph.get(id) ?? [];
    for (const neighbour of neighbours) {
      inDegree.set(neighbour, (inDegree.get(neighbour) ?? 0) - 1);
      if ((inDegree.get(neighbour) ?? 0) === 0) queue.push(neighbour);
    }
  }

  if (ordered.length !== tasks.length) {
    const seen = new Set(ordered.map((t) => t.id));
    for (const task of tasks) if (!seen.has(task.id)) ordered.push(task);
  }
  return ordered;
}

async function loadTasks(tasksPath: string): Promise<{ tasks: TaskItem[] }> {
  const contents = await readFile(tasksPath, 'utf8');
  const parsed = JSON.parse(contents) as { tasks?: TaskItem[] };
  const tasks = Array.isArray(parsed.tasks) ? (parsed.tasks as TaskItem[]) : [];
  return { tasks };
}

async function saveTasks(tasksPath: string, tasks: TaskItem[]): Promise<void> {
  const contents = JSON.stringify({ tasks }, null, 2) + '\n';
  await writeFile(tasksPath, contents, 'utf8');
}

export async function generateSummary(tasksPath: string, outputPath: string): Promise<void> {
  const { tasks } = await loadTasks(tasksPath);
  const completed = tasks.filter((t) => t.done === true);
  const remaining = tasks.filter((t) => t.done !== true);

  const lines: string[] = [];
  lines.push('# Project Summary');
  lines.push('');
  lines.push(`- Completed: ${completed.length}`);
  lines.push(`- Remaining: ${remaining.length}`);
  lines.push('');
  lines.push('## Completed Tasks');
  lines.push(...(completed.length ? completed.map((t) => `- [x] ${t.id}: ${t.name}`) : ['- None']));
  lines.push('');
  lines.push('## Remaining Tasks');
  lines.push(...(remaining.length ? remaining.map((t) => `- [ ] ${t.id}: ${t.name}`) : ['- None']));
  lines.push('');

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, lines.join('\n'), 'utf8');
}

export async function runTaskManager(options: TaskManagerOptions): Promise<void> {
  const cwd = path.resolve(options.cwd);
  const tasksPath = await resolveTasksPath(cwd, options.tasksPath);
  const logsPath = options.logsPath ? path.resolve(cwd, options.logsPath) : path.resolve(cwd, '.codemachine', 'logs.jsonl');
  const abortSignal = options.abortSignal;

  const planPath = path.resolve(cwd, '.codemachine', 'plan', 'plan.md');
  const fallbackPlan = path.resolve(cwd, '.codemachine', 'plan.md');
  const userReqPath = path.resolve(cwd, '.codemachine', 'inputs', 'specifications.md');

  const planContent = (await fileExists(planPath))
    ? await readFile(planPath, 'utf8')
    : (await fileExists(fallbackPlan))
      ? await readFile(fallbackPlan, 'utf8')
      : '';
  const specContent = (await fileExists(userReqPath)) ? await readFile(userReqPath, 'utf8') : '';

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
      const prompt = [
        buildTaskPrompt(task),
        '',
        '---',
        'System Guidance:',
        'You are a specialized implementation agent in a multi-agent system.',
        'Follow the task details precisely and produce concrete changes in the workspace.',
        'MUST NOT alter unrelated files. Keep diffs minimal and focused.',
        planContent ? `Project plan (excerpt)\n---\n${planContent.slice(0, 1500)}` : '',
        specContent ? `Specification (excerpt)\n---\n${specContent.slice(0, 1500)}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const start = Date.now();
      await appendLog(logsPath, {
        timestamp: new Date().toISOString(),
        taskId: task.id,
        taskName: task.name,
        phase: task.phase,
        agent: agentPrimary,
        outcome: 'start',
      });

      let verify = { ok: false as boolean, failedCommand: undefined as string | undefined };
      let attempts = 0;
      const execFn = options.execute ?? ((agentId: string, taskPrompt: string) => runAgent(agentId, taskPrompt, cwd, abortSignal));

      while (attempts < 3 && !verify.ok) {
        if (abortSignal?.aborted) break;
        await execFn(agentPrimary, prompt);
        verify = await verifyTask(task, cwd);
        attempts += 1;
      }

      const durationMs = Date.now() - start;
      if (verify.ok) {
        const current = await loadTasks(tasksPath);
        const match = current.tasks.find((t) => t.id === task.id);
        if (match) match.done = true;
        await saveTasks(tasksPath, current.tasks);
        progress = true;
        await appendLog(logsPath, {
          timestamp: new Date().toISOString(),
          taskId: task.id,
          taskName: task.name,
          phase: task.phase,
          agent: agentPrimary,
          durationMs,
          outcome: 'success',
        });
      } else {
        await appendLog(logsPath, {
          timestamp: new Date().toISOString(),
          taskId: task.id,
          taskName: task.name,
          phase: task.phase,
          agent: agentPrimary,
          durationMs,
          outcome: 'failed',
          message: verify.failedCommand ? `Verification failed: ${verify.failedCommand}` : 'Verification unavailable',
        });
      }

      if (!options.parallel && progress) break;
    }
  }
}
