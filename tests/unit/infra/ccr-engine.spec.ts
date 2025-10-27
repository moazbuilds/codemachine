import { afterEach, describe, expect, it, vi } from 'vitest';

import * as spawnModule from '../../../src/infra/process/spawn.js';
import { runCcr } from '../../../src/infra/engines/providers/ccr/index.js';

describe('CCR Engine Runner', () => {
  const workingDir = '/tmp/workspace/project';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs the CCR CLI and returns stdout', async () => {
    const spawnSpy = vi.spyOn(spawnModule, 'spawnProcess').mockResolvedValue({
      exitCode: 0,
      stdout: 'ccr output',
      stderr: '',
    });

    const result = await runCcr({
      prompt: 'Hello CCR',
      workingDir,
      env: { CUSTOM: 'value' },
    });

    expect(result).toEqual({ stdout: 'ccr output', stderr: '' });
    expect(spawnSpy).toHaveBeenCalledTimes(1);

    const callOptions = spawnSpy.mock.calls[0]?.[0];
    expect(callOptions?.command).toBe('ccr');
    expect(callOptions?.args).toEqual([
      'code',
      '--print',
      '--output-format',
      'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
      '--permission-mode',
      'bypassPermissions',
    ]);
    expect(callOptions?.cwd).toBe(workingDir);
    expect(callOptions?.env).toMatchObject({
      CUSTOM: 'value',
      CCR_CONFIG_DIR: expect.any(String)
    });
    expect(callOptions?.stdinInput).toBe('Hello CCR');
    expect(callOptions?.onStdout).toBeTypeOf('function');
    expect(callOptions?.onStderr).toBeTypeOf('function');
  });

  it('includes model in command when specified', async () => {
    const spawnSpy = vi.spyOn(spawnModule, 'spawnProcess').mockResolvedValue({
      exitCode: 0,
      stdout: 'ccr output with model',
      stderr: '',
    });

    await runCcr({
      prompt: 'Hello CCR with model',
      workingDir,
      model: 'sonnet',
    });

    const callOptions = spawnSpy.mock.calls[0]?.[0];
    expect(callOptions?.args).toEqual([
      'code',
      '--print',
      '--output-format',
      'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
      '--permission-mode',
      'bypassPermissions',
      '--model',
      'sonnet',
    ]);
  });

  it('throws when the CCR CLI exits with a non-zero status code', async () => {
    vi.spyOn(spawnModule, 'spawnProcess').mockResolvedValue({
      exitCode: 2,
      stdout: '',
      stderr: 'fatal: unable to launch',
    });

    await expect(
      runCcr({
        prompt: 'Trigger failure',
        workingDir,
      }),
    ).rejects.toThrow(/CLI exited with code 2/);
  });

  it('forwards stdout and stderr chunks through the streaming callbacks', async () => {
    const spawnSpy = vi.spyOn(spawnModule, 'spawnProcess').mockImplementation(async (options) => {
      options.onStdout?.(
        JSON.stringify({
          type: 'assistant',
          message: { content: [{ type: 'text', text: 'All tasks done' }] }
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

    const result = await runCcr({
      prompt: 'Stream please',
      workingDir,
      onData: handleData,
      onErrorData: handleError,
    });

    expect(handleData).toHaveBeenCalledWith('💬 TEXT: All tasks done\n');
    expect(handleError).toHaveBeenCalledWith('error-chunk');
    expect(result).toEqual({ stdout: 'final output', stderr: 'final error output' });
    expect(spawnSpy).toHaveBeenCalledTimes(1);
  });

  it('sets up proper CCR_CONFIG_DIR environment variable', async () => {
    const spawnSpy = vi.spyOn(spawnModule, 'spawnProcess').mockResolvedValue({
      exitCode: 0,
      stdout: 'ccr output',
      stderr: '',
    });

    await runCcr({
      prompt: 'Hello CCR',
      workingDir,
    });

    const callOptions = spawnSpy.mock.calls[0]?.[0];
    expect(callOptions?.env?.CCR_CONFIG_DIR).toMatch(/\.codemachine\/ccr$/);
  });

  it('handles missing prompt with proper error', async () => {
    await expect(
      runCcr({
        prompt: '',
        workingDir,
      }),
    ).rejects.toThrow('runCcr requires a prompt.');
  });

  it('handles missing working directory with proper error', async () => {
    await expect(
      runCcr({
        prompt: 'Hello CCR',
        workingDir: '',
      }),
    ).rejects.toThrow('runCcr requires a working directory.');
  });
});