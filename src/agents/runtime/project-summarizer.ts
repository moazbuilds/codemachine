import * as fs from 'node:fs/promises';
import * as path from 'node:path';

type UnknownRecord = Record<string, unknown>;

interface TaskItem {
  id: string;
  name: string;
  done?: boolean;
  [key: string]: unknown;
}

interface TasksFile {
  tasks: TaskItem[];
}

export interface SummarizeOptions {
  tasksPath: string;
  outputPath: string;
}

async function loadTasks(tasksPath: string): Promise<TasksFile> {
  const contents = await fs.readFile(tasksPath, 'utf8');
  const parsed = JSON.parse(contents) as UnknownRecord;
  const arr = Array.isArray(parsed.tasks) ? (parsed.tasks as UnknownRecord[]) : [];
  const tasks: TaskItem[] = arr.map((t) => ({ ...t })) as TaskItem[];
  return { tasks };
}

function renderMarkdown(completed: TaskItem[], remaining: TaskItem[]): string {
  const lines: string[] = [];
  lines.push('# Project Summary');
  lines.push('');
  lines.push(`- Completed: ${completed.length}`);
  lines.push(`- Remaining: ${remaining.length}`);
  lines.push('');
  lines.push('## Completed Tasks');
  if (completed.length === 0) {
    lines.push('- None');
  } else {
    for (const t of completed) lines.push(`- [x] ${t.id}: ${t.name}`);
  }
  lines.push('');
  lines.push('## Remaining Tasks');
  if (remaining.length === 0) {
    lines.push('- None');
  } else {
    for (const t of remaining) lines.push(`- [ ] ${t.id}: ${t.name}`);
  }
  lines.push('');
  return lines.join('\n');
}

export async function summarize({ tasksPath, outputPath }: SummarizeOptions): Promise<void> {
  const { tasks } = await loadTasks(tasksPath);
  const completed = tasks.filter((t) => t.done === true);
  const remaining = tasks.filter((t) => t.done !== true);

  const md = renderMarkdown(completed, remaining);
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(outputPath, md, 'utf8');
}

export default summarize;

