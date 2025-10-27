import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the runner module to avoid calling the actual CCR CLI
vi.mock('../../../src/infra/engines/providers/ccr/execution/runner.js', async () => {
  const actual = await vi.importActual('../../../src/infra/engines/providers/ccr/execution/runner.js');
  return {
    ...actual,
    runCcr: vi.fn().mockResolvedValue({ stdout: 'mocked output', stderr: '' }),
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
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes CCR prompt successfully', async () => {
    const runCcrSpy = vi.mocked(runCcr);

    await runCcrPrompt({
      agentId: mockAgentId,
      prompt: mockPrompt,
      cwd: mockCwd,
    });

    expect(runCcrSpy).toHaveBeenCalledTimes(1);
    expect(runCcrSpy).toHaveBeenCalledWith({
      prompt: mockPrompt,
      workingDir: mockCwd,
      onData: expect.any(Function),
      onErrorData: expect.any(Function),
    });
  });

  it('executes CCR prompt with model parameter', async () => {
    const runCcrSpy = vi.mocked(runCcr);

    await runCcrPrompt({
      agentId: mockAgentId,
      prompt: mockPrompt,
      cwd: mockCwd,
      model: 'sonnet',
    });

    expect(runCcrSpy).toHaveBeenCalledTimes(1);
    expect(runCcrSpy).toHaveBeenCalledWith({
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
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

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
    const runCcrSpy = vi.mocked(runCcr);

    // Mock stdout write to throw an error
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => {
      throw new Error('stdout write error');
    });

    // Should not throw even if stdout write fails
    await expect(runCcrPrompt({
      agentId: mockAgentId,
      prompt: mockPrompt,
      cwd: mockCwd,
    })).resolves.not.toThrow();

    expect(runCcrSpy).toHaveBeenCalledTimes(1);
    stdoutSpy.mockRestore();
  });

  it('handles stderr write errors gracefully', async () => {
    const runCcrSpy = vi.mocked(runCcr);

    // Mock stderr write to throw an error
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => {
      throw new Error('stderr write error');
    });

    // Should not throw even if stderr write fails
    await expect(runCcrPrompt({
      agentId: mockAgentId,
      prompt: mockPrompt,
      cwd: mockCwd,
    })).resolves.not.toThrow();

    expect(runCcrSpy).toHaveBeenCalledTimes(1);
    stderrSpy.mockRestore();
  });
});