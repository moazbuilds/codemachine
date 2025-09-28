import * as fs from 'node:fs/promises';

type UnknownRecord = Record<string, unknown>;

interface TaskItem {
  done?: boolean;
  [key: string]: unknown;
}

interface TasksFile {
  tasks: TaskItem[];
}

export interface RetryOptions {
  tasksPath: string;
  logsPath?: string;
  orchestrate: (options: { tasksPath: string; logsPath?: string }) => Promise<void>;
}

async function loadTasks(tasksPath: string): Promise<TasksFile> {
  const contents = await fs.readFile(tasksPath, 'utf8');
  const parsed = JSON.parse(contents) as UnknownRecord;
  const arr = Array.isArray(parsed.tasks) ? (parsed.tasks as UnknownRecord[]) : [];
  const tasks: TaskItem[] = arr.map((t) => ({ ...t })) as TaskItem[];
  return { tasks };
}

export async function retry({ orchestrate, tasksPath, logsPath }: RetryOptions): Promise<boolean> {
  const { tasks } = await loadTasks(tasksPath);
  const remaining = tasks.filter((t) => t.done !== true);
  if (remaining.length > 0) {
    await orchestrate({ tasksPath, logsPath });
    return true;
  }
  return false;
}

export default retry;

