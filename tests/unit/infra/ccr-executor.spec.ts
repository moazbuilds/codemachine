<<<<<<< HEAD
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the runner module to avoid calling the actual CCR CLI
vi.mock('../../../src/infra/engines/providers/ccr/execution/runner.js', async () => {
  const actual = await vi.importActual('../../../src/infra/engines/providers/ccr/execution/runner.js');
  return {
    ...actual,
    runCcr: vi.fn().mockResolvedValue({ stdout: 'mocked output', stderr: '' }),
=======
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

// Mock the runner module to avoid calling the actual CCR CLI
mock.module('../../../src/infra/engines/providers/ccr/execution/runner.js', () => {
  return {
    runCcr: mock(() => Promise.resolve({ stdout: 'mocked output', stderr: '' })),
>>>>>>> origin/main
  };
});

import { runCcrPrompt } from '../../../src/infra/engines/providers/ccr/execution/executor.js';
import { runCcr } from '../../../src/infra/engines/providers/ccr/execution/runner.js';

describe('CCR Executor', () => {
  const mockAgentId = 'test-agent';
  const mockPrompt = 'test prompt for CCR';
  const mockCwd = '/tmp/test-dir';

  beforeEach(() => {
    // Clear any environment variables that might affect the tests
    delete process.env.CODEMACHINE_SKIP_CCR;
<<<<<<< HEAD
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes CCR prompt successfully', async () => {
    const runCcrSpy = vi.mocked(runCcr);

=======
    // Clear mock call counts
    if (runCcr.mockClear) {
      runCcr.mockClear();
    }
  });

  afterEach(() => {
    // Bun automatically restores mocks
  });

  it('executes CCR prompt successfully', async () => {
>>>>>>> origin/main
    await runCcrPrompt({
      agentId: mockAgentId,
      prompt: mockPrompt,
      cwd: mockCwd,
    });

<<<<<<< HEAD
    expect(runCcrSpy).toHaveBeenCalledTimes(1);
    expect(runCcrSpy).toHaveBeenCalledWith({
=======
    expect(runCcr).toHaveBeenCalledTimes(1);
    expect(runCcr).toHaveBeenCalledWith({
>>>>>>> origin/main
      prompt: mockPrompt,
      workingDir: mockCwd,
      onData: expect.any(Function),
      onErrorData: expect.any(Function),
    });
  });

  it('executes CCR prompt with model parameter', async () => {
<<<<<<< HEAD
    const runCcrSpy = vi.mocked(runCcr);

=======
>>>>>>> origin/main
    await runCcrPrompt({
      agentId: mockAgentId,
      prompt: mockPrompt,
      cwd: mockCwd,
      model: 'sonnet',
    });

<<<<<<< HEAD
    expect(runCcrSpy).toHaveBeenCalledTimes(1);
    expect(runCcrSpy).toHaveBeenCalledWith({
=======
    expect(runCcr).toHaveBeenCalledTimes(1);
    expect(runCcr).toHaveBeenCalledWith({
>>>>>>> origin/main
      prompt: mockPrompt,
      workingDir: mockCwd,
      model: 'sonnet',
      onData: expect.any(Function),
      onErrorData: expect.any(Function),
    });
  });

  it('handles dry run mode', async () => {
    // Set dry run environment variable
    process.env.CODEMACHINE_SKIP_CCR = '1';

    // Spy on console.log to verify it's called with the dry run message
<<<<<<< HEAD
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
=======
    const consoleSpy = spyOn(console, 'log').mockImplementation(() => {});
>>>>>>> origin/main

    await runCcrPrompt({
      agentId: mockAgentId,
      prompt: mockPrompt,
      cwd: mockCwd,
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[dry-run] test-agent: test prompt for CCR')
    );
  });

  it('handles stdout write errors gracefully', async () => {
<<<<<<< HEAD
    const runCcrSpy = vi.mocked(runCcr);

    // Mock stdout write to throw an error
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => {
=======
    // Mock stdout write to throw an error
    const stdoutSpy = spyOn(process.stdout, 'write').mockImplementation(() => {
>>>>>>> origin/main
      throw new Error('stdout write error');
    });

    // Should not throw even if stdout write fails
<<<<<<< HEAD
    await expect(runCcrPrompt({
      agentId: mockAgentId,
      prompt: mockPrompt,
      cwd: mockCwd,
    })).resolves.not.toThrow();

    expect(runCcrSpy).toHaveBeenCalledTimes(1);
=======
    await runCcrPrompt({
      agentId: mockAgentId,
      prompt: mockPrompt,
      cwd: mockCwd,
    });

    expect(runCcr).toHaveBeenCalledTimes(1);
>>>>>>> origin/main
    stdoutSpy.mockRestore();
  });

  it('handles stderr write errors gracefully', async () => {
<<<<<<< HEAD
    const runCcrSpy = vi.mocked(runCcr);

    // Mock stderr write to throw an error
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => {
=======
    // Mock stderr write to throw an error
    const stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => {
>>>>>>> origin/main
      throw new Error('stderr write error');
    });

    // Should not throw even if stderr write fails
<<<<<<< HEAD
    await expect(runCcrPrompt({
      agentId: mockAgentId,
      prompt: mockPrompt,
      cwd: mockCwd,
    })).resolves.not.toThrow();

    expect(runCcrSpy).toHaveBeenCalledTimes(1);
=======
    await runCcrPrompt({
      agentId: mockAgentId,
      prompt: mockPrompt,
      cwd: mockCwd,
    });

    expect(runCcr).toHaveBeenCalledTimes(1);
>>>>>>> origin/main
    stderrSpy.mockRestore();
  });
});