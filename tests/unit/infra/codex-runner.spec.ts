import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import * as spawnModule from '../../../src/infra/process/spawn.js';
import { runCodex } from '../../../src/infra/codex/codex-runner.js';

describe('runCodex', () => {
  const workingDir = '/tmp/workspace/project';
  const cliPath = path.resolve(workingDir, '..', '..', 'cli', 'codex-cli.js');

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
    expect(callOptions?.command).toBe(process.execPath);
    expect(callOptions?.args).toEqual([cliPath, 'run', 'default', 'Hello Codex']);
    expect(callOptions?.cwd).toBe(workingDir);
    expect(callOptions?.env).toMatchObject({ CUSTOM: 'value' });
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
    ).rejects.toThrow(/code 2: fatal: unable to launch/);
  });

  it('forwards stdout and stderr chunks through the streaming callbacks', async () => {
    const spawnSpy = vi.spyOn(spawnModule, 'spawnProcess').mockImplementation(async (options) => {
      options.onStdout?.('chunk-1');
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

    expect(handleData).toHaveBeenCalledWith('chunk-1');
    expect(handleError).toHaveBeenCalledWith('error-chunk');
    expect(result).toEqual({ stdout: 'final output', stderr: 'final error output' });
    expect(spawnSpy).toHaveBeenCalledTimes(1);
  });
});
