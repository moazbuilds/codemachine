import { describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock runCodex to capture options and simulate output
vi.mock('../../../src/infra/engines/codex/index.js', async () => {
  return {
    runCodex: vi.fn(async (opts: { onData?: (chunk: string) => void }) => {
      // simulate some streaming
      opts.onData?.('stream-');
      opts.onData?.('output');
      return { stdout: 'final-stream-output', stderr: '' };
    }),
    ensureAuth: vi.fn(async () => true),
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

// We import after mocks
import { registerAgentCommand } from '../../../src/cli/commands/agent.command.js';
import { runCodex } from '../../../src/infra/engines/codex/index.js';

describe('CLI agent wrapper', () => {
  it('builds composite prompt and executes Codex with streaming; updates memory', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'agent-wrapper-'));
    const configDir = join(tempDir, 'config');
    const promptsDir = join(tempDir, 'prompts');
    await mkdir(configDir, { recursive: true });
    await mkdir(promptsDir, { recursive: true });

    const promptPath = join(promptsDir, 'backend-dev.md');
    await writeFile(promptPath, 'Template for backend-dev agent', 'utf8');
    await writeFile(join(configDir, 'package.json'), '{"type":"commonjs"}\n', 'utf8');
    await writeFile(
      join(configDir, 'agents.js'),
      `module.exports = [
  {
    id: 'backend-dev',
    name: 'Backend Developer',
    promptPath: ${JSON.stringify(promptPath)}
  }
];
`,
      'utf8',
    );

    const previousDir = process.env.CODEMACHINE_CWD;
    process.env.CODEMACHINE_CWD = tempDir;

    const program = new Command();
    registerAgentCommand(program);

    const id = 'backend-dev';
    const profile = 'test-profile';
    const userPrompt = 'Please implement a minimal API';

    try {
      await program.parseAsync(['agent', id, userPrompt, '--profile', profile], { from: 'user' });
    } finally {
      if (previousDir === undefined) {
        delete process.env.CODEMACHINE_CWD;
      } else {
        process.env.CODEMACHINE_CWD = previousDir;
      }
      await rm(tempDir, { recursive: true, force: true });
    }

    // Verify runCodex call
    const mockedRunCodex = vi.mocked(runCodex);
    expect(mockedRunCodex.mock.calls.length).toBe(1);
    const callOpts = mockedRunCodex.mock.calls[0][0];
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
