import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { retry } from '../../../src/agents/runtime/retry';
import { end } from '../../../src/agents/runtime/end';

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

describe('Runtime recovery workflow', () => {
  const tmpRoot = path.join(process.cwd(), '.tmp-tests');
  const testDir = path.join(tmpRoot, `recovery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const cmDir = path.join(testDir, '.codemachine');
  const tasksPath = path.join(cmDir, 'tasks.json');

  beforeAll(async () => {
    await ensureDir(cmDir);
  });

  afterAll(async () => {
    // Clean up temp directory tree
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('retries orchestration when unfinished tasks exist and returns true', async () => {
    const tasks = {
      tasks: [
        { id: 'T1', name: 'Alpha task', done: true },
        { id: 'T2', name: 'Beta task', done: false },
      ],
    };
    await fs.writeFile(tasksPath, JSON.stringify(tasks, null, 2), 'utf8');

    const orchestrate = vi.fn(async () => {
      // no-op
    });

    const didRetry = await retry({ orchestrate, tasksPath, logsPath: path.join(cmDir, 'logs.jsonl') });
    expect(didRetry).toBe(true);
    expect(orchestrate).toHaveBeenCalledTimes(1);
    expect(orchestrate).toHaveBeenCalledWith({ tasksPath, logsPath: path.join(cmDir, 'logs.jsonl') });
  });

  it('does not retry when all tasks are done and returns false', async () => {
    const tasksAllDone = {
      tasks: [
        { id: 'T1', name: 'Alpha task', done: true },
        { id: 'T2', name: 'Beta task', done: true },
      ],
    };
    await fs.writeFile(tasksPath, JSON.stringify(tasksAllDone, null, 2), 'utf8');

    const orchestrate = vi.fn(async () => {
      // no-op
    });

    const didRetry = await retry({ orchestrate, tasksPath });
    expect(didRetry).toBe(false);
    expect(orchestrate).not.toHaveBeenCalled();
  });

  it('end() returns success banner when all tasks complete; empty string otherwise', async () => {
    // Not all done -> empty string
    const someRemaining = {
      tasks: [
        { id: 'T1', name: 'Alpha task', done: true },
        { id: 'T2', name: 'Beta task', done: false },
      ],
    };
    await fs.writeFile(tasksPath, JSON.stringify(someRemaining, null, 2), 'utf8');
    const notDoneBanner = await end({ tasksPath });
    expect(notDoneBanner).toBe('');

    // All done -> success banner string
    const allDone = {
      tasks: [
        { id: 'T1', name: 'Alpha task', done: true },
        { id: 'T2', name: 'Beta task', done: true },
      ],
    };
    await fs.writeFile(tasksPath, JSON.stringify(allDone, null, 2), 'utf8');
    const banner = await end({ tasksPath });
    expect(banner).toContain('✅ All tasks completed successfully!');
    expect(banner.startsWith('========================================')).toBe(true);
  });
});
