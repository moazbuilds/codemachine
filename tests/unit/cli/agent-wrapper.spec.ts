import { describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

// Mock runCodex to capture options and simulate output
vi.mock('../../../src/infra/codex/codex-runner.js', async () => {
  return {
    runCodex: vi.fn(async (opts: any) => {
      // simulate some streaming
      opts.onData?.('stream-');
      opts.onData?.('output');
      return { stdout: 'final-stream-output', stderr: '' };
    }),
  };
});

// Mock MemoryStore to control list and verify append
const appendMock = vi.fn();
const listMock = vi.fn(async () => [
  { agentId: 'backend-dev', content: 'memo-1', timestamp: '2024-05-01T10:00:00Z' },
  { agentId: 'backend-dev', content: 'memo-2', timestamp: '2024-05-01T11:00:00Z' },
]);

vi.mock('../../../src/agents/memory/memory-store.js', async () => {
  return {
    MemoryStore: class {
      list = listMock;
      append = appendMock;
    },
  };
});

// Mock Node built-ins used by agent.command to avoid ESM/CJS interop during tests
vi.mock('node:module', async () => {
  return {
    createRequire: () => {
      // Return a require() stub that supplies the agents list
      return () => [
        {
          id: 'backend-dev',
          name: 'Backend Developer',
          promptPath: '/virtual/prompt.md',
        },
      ];
    },
  };
});

vi.mock('node:fs', async () => {
  return {
    promises: {
      readFile: vi.fn(async () => 'Template for backend-dev agent'),
    },
  };
});

// We import after mocks
import { registerAgentCommand } from '../../../src/cli/commands/agent.command.js';
import { runCodex } from '../../../src/infra/codex/codex-runner.js';

describe('CLI agent wrapper', () => {
  it('builds composite prompt and executes Codex with streaming; updates memory', async () => {
    const program = new Command();
    registerAgentCommand(program);

    const id = 'backend-dev';
    const profile = 'test-profile';
    const userPrompt = 'Please implement a minimal API';

    await program.parseAsync(['agent', id, userPrompt, '--profile', profile], { from: 'user' });

    // Verify runCodex call
    expect((runCodex as any).mock.calls.length).toBe(1);
    const callOpts = (runCodex as any).mock.calls[0][0];
    expect(callOpts.profile).toBe(profile);
    expect(callOpts.workingDir).toBe(process.cwd());
    expect(typeof callOpts.onData).toBe('function');

    // Composite prompt checks
    const composite = callOpts.prompt as string;
    expect(composite).toContain('[SYSTEM]');
    expect(composite).toContain('[MEMORY]');
    expect(composite).toContain('[REQUEST]');
    expect(composite).toContain('memo-1');
    expect(composite).toContain('memo-2');
    expect(composite).toContain(userPrompt);

    // Memory append should store last 2000 chars from stdout
    expect(appendMock).toHaveBeenCalledTimes(1);
    const appended = appendMock.mock.calls[0][0];
    expect(appended.agentId).toBe(id);
    expect(typeof appended.timestamp).toBe('string');
    expect(appended.content).toBe('final-stream-output');
  });
});
