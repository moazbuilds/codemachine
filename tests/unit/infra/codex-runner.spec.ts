// Unused import removed

import { afterEach, describe, expect, it, vi } from 'vitest';

import * as spawnModule from '../../../src/infra/process/spawn.js';
import { runCodex } from '../../../src/infra/engines/codex/index.js';

describe('runCodex', () => {
  const workingDir = '/tmp/workspace/project';
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs the Codex CLI and returns stdout', async () => {
    const spawnSpy = vi.spyOn(spawnModule, 'spawnProcess').mockResolvedValue({
      exitCode: 0,
      stdout: 'codex output',
      stderr: '',
    });

    const result = await runCodex({
      profile: 'default',
      prompt: 'Hello Codex',
      workingDir,
      env: { CUSTOM: 'value' },
    });

    expect(result).toEqual({ stdout: 'codex output', stderr: '' });
    expect(spawnSpy).toHaveBeenCalledTimes(1);

    const callOptions = spawnSpy.mock.calls[0]?.[0];
    expect(callOptions?.command).toBe('codex');
    expect(callOptions?.args).toEqual([
      'exec',
      '--json',
      '--profile',
      'default',
      '--skip-git-repo-check',
      '--sandbox',
      'danger-full-access',
      '--dangerously-bypass-approvals-and-sandbox',
      '-C',
      workingDir,
      '-',
    ]);
    expect(callOptions?.cwd).toBe(workingDir);
    expect(callOptions?.env).toMatchObject({ CUSTOM: 'value', CODEX_HOME: expect.any(String) });
    expect(callOptions?.stdinInput).toBe('Hello Codex');
    expect(callOptions?.onStdout).toBeTypeOf('function');
    expect(callOptions?.onStderr).toBeTypeOf('function');
  });

  it('throws when the Codex CLI exits with a non-zero status code', async () => {
    vi.spyOn(spawnModule, 'spawnProcess').mockResolvedValue({
      exitCode: 2,
      stdout: '',
      stderr: 'fatal: unable to launch',
    });

    await expect(
      runCodex({
        profile: 'failure',
        prompt: 'Trigger failure',
        workingDir,
      }),
    ).rejects.toThrow(/Codex CLI exited with code 2/);
  });

  it('forwards stdout and stderr chunks through the streaming callbacks', async () => {
    const spawnSpy = vi.spyOn(spawnModule, 'spawnProcess').mockImplementation(async (options) => {
      options.onStdout?.(
        JSON.stringify({
          type: 'item.completed',
          item: { type: 'agent_message', text: 'All tasks done' },
        }) + '\n',
      );
      options.onStderr?.('error-chunk');
      return {
        exitCode: 0,
        stdout: 'final output',
        stderr: 'final error output',
      };
    });

    const handleData = vi.fn();
    const handleError = vi.fn();

    const result = await runCodex({
      profile: 'stream',
      prompt: 'Stream please',
      workingDir,
      onData: handleData,
      onErrorData: handleError,
    });

    expect(handleData).toHaveBeenCalledWith('💬 MESSAGE: All tasks done\n');
    expect(handleError).toHaveBeenCalledWith('error-chunk');
    expect(result).toEqual({ stdout: 'final output', stderr: 'final error output' });
    expect(spawnSpy).toHaveBeenCalledTimes(1);
  });
});
