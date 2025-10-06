import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAuth,
  ensureAuth,
  isAuthenticated,
  getAuthFilePath,
  nextAuthMenuAction,
  resolveCodexHome,
} from '../../../src/app/services/backends/codex/auth-status.js';

vi.mock('execa', () => {
  return {
    execa: vi.fn(async () => ({ exitCode: 0 })),
  };
});

describe('auth flow', () => {
  let execaMock: typeof import('execa').execa;
  let prevEnv: string | undefined;
  let tempHome: string;

  beforeEach(async () => {
    execaMock = (await import('execa')).execa;
    prevEnv = process.env.CODEX_HOME;
    tempHome = await mkdtemp(join(tmpdir(), 'codemachine-auth-'));
    process.env.CODEX_HOME = tempHome;
  });

  afterEach(async () => {
    if (prevEnv === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = prevEnv;
    }
    await rm(tempHome, { recursive: true, force: true });
  });

  it('reports authentication status based on auth.json presence', async () => {
    const codexHome = await resolveCodexHome();
    const authPath = getAuthFilePath(codexHome);

    // Initially unauthenticated
    expect(await isAuthenticated()).toBe(false);

    // Create auth file -> becomes authenticated
    await mkdir(dirname(authPath), { recursive: true });
    await writeFile(authPath, '{"token":"mock"}', 'utf8');
    expect(await isAuthenticated()).toBe(true);
  });

  it('triggers codex login and creates auth.json when unauthenticated', async () => {
    const prevSkip = process.env.CODEMACHINE_SKIP_AUTH;
    delete process.env.CODEMACHINE_SKIP_AUTH;

    const codexHome = await resolveCodexHome();
    const authPath = getAuthFilePath(codexHome);

    // Sanity: no auth file pre-exists
    await expect(stat(authPath)).rejects.toBeDefined();

    const beforeAction = await nextAuthMenuAction();
    expect(beforeAction).toBe('login');

    await ensureAuth();

    // Verify execa called with correct env and command
    expect(execaMock).toHaveBeenCalledTimes(1);
    const call = execaMock.mock.calls[0];
    expect(call[0]).toBe('codex');
    expect(call[1]).toEqual(['login']);
    expect(call[2]?.env?.CODEX_HOME).toBe(codexHome);

    // Auth file should exist now
    const content = await readFile(authPath, 'utf8');
    expect(typeof content).toBe('string');

    const afterAction = await nextAuthMenuAction();
    expect(afterAction).toBe('logout');

    if (prevSkip === undefined) {
      process.env.CODEMACHINE_SKIP_AUTH = '1';
    } else {
      process.env.CODEMACHINE_SKIP_AUTH = prevSkip;
    }
  });

  it('does not call codex login when already authenticated and supports clearing', async () => {
    const codexHome = await resolveCodexHome();
    const authPath = getAuthFilePath(codexHome);
    await mkdir(dirname(authPath), { recursive: true });
    await writeFile(authPath, '{"token":"x"}', 'utf8');

    await ensureAuth();
    expect(execaMock).not.toHaveBeenCalled();

    expect(await nextAuthMenuAction()).toBe('logout');

    await clearAuth();
    await expect(stat(authPath)).rejects.toBeDefined();
    expect(await nextAuthMenuAction()).toBe('login');
  });
});
