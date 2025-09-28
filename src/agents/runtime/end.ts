import * as fs from 'node:fs/promises';

type UnknownRecord = Record<string, unknown>;

interface TaskItem {
  done?: boolean;
  [key: string]: unknown;
}

interface TasksFile {
  tasks: TaskItem[];
}

export interface EndOptions {
  tasksPath: string;
}

async function loadTasks(tasksPath: string): Promise<TasksFile> {
  const contents = await fs.readFile(tasksPath, 'utf8');
  const parsed = JSON.parse(contents) as UnknownRecord;
  const arr = Array.isArray(parsed.tasks) ? (parsed.tasks as UnknownRecord[]) : [];
  const tasks: TaskItem[] = arr.map((t) => ({ ...t })) as TaskItem[];
  return { tasks };
}

export async function end({ tasksPath }: EndOptions): Promise<string> {
  const { tasks } = await loadTasks(tasksPath);
  const allDone = tasks.length > 0 && tasks.every((t) => t.done === true);
  if (!allDone) return '';
  return [
    '========================================',
    '✅ All tasks completed successfully!',
    '========================================',
  ].join('\n');
}

export default end;

