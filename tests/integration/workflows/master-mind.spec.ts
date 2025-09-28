import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

import { orchestrateMasterMind } from '../../../src/core/workflows/master-mind.js';

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

describe('Master Mind Orchestrator', () => {
  const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
  let tmpRoot: string;
  let planDir: string;
  let logsPath: string;
  let tasksPath: string;

  beforeEach(async () => {
    tmpRoot = path.join(projectRoot, '.tmp', `master-mind-${Date.now()}`);
    planDir = path.join(tmpRoot, '.codemachine', 'plan');
    await ensureDir(planDir);
    logsPath = path.join(tmpRoot, '.codemachine', 'logs.jsonl');
    tasksPath = path.join(planDir, 'tasks.json');

    const tasks = {
      tasks: [
        {
          id: 'T_A',
          name: 'Dummy build task',
          phase: 'Building',
          done: false,
          details: '### Verification\n- `test -f README.md` exits 0.\n',
        },
        {
          id: 'T_B',
          name: 'Dependent build task',
          phase: 'Building',
          dependsOn: ['T_A'],
          done: false,
          details: '### Verification\n- `test -f README.md` exits 0.\n',
        },
      ],
    };
    await fs.writeFile(tasksPath, JSON.stringify(tasks, null, 2));
  });

  it('processes pending tasks, updates tasks.json, writes logs, and respects dependency order', async () => {
    const calls: { agent: string; prompt: string }[] = [];
    const execute = async (agentId: string, prompt: string) => {
      calls.push({ agent: agentId, prompt });
      // Deterministic no-op
    };

    await orchestrateMasterMind({
      cwd: projectRoot,
      tasksPath,
      logsPath,
      parallel: false,
      execute,
    });

    // It updates tasks.json by flipping tasks to done
    const after = JSON.parse(await fs.readFile(tasksPath, 'utf8')) as { tasks: any[] };
    const a = after.tasks.find((t) => t.id === 'T_A');
    const b = after.tasks.find((t) => t.id === 'T_B');
    expect(a?.done).toBe(true);
    expect(b?.done).toBe(true);

    // It writes a log line to logs.jsonl
    const logsContent = await fs.readFile(logsPath, 'utf8');
    const lines = logsContent.trim().split(/\n/).filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    const records = lines.map((l) => JSON.parse(l));
    // Find success records
    const successRecords = records.filter((r) => r.outcome === 'success' && r.message === 'phase:complete');
    expect(successRecords.length).toBeGreaterThanOrEqual(2);
    const order = successRecords.map((r) => r.taskId);
    // Respect dependency ordering: T_A completes before T_B
    expect(order.indexOf('T_A')).toBeLessThan(order.indexOf('T_B'));

    // It loads tasks and processes at least one pending task (implicit above)
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});

