import * as path from 'node:path';

import { runCodex } from '../../../infra/codex/codex-runner.js';
import { MemoryAdapter } from '../../../infra/fs/memory-adapter.js';
import { MemoryStore } from '../../../agents/memory/memory-store.js';

export function shouldSkipCodex(): boolean {
  return process.env.CODEMACHINE_SKIP_CODEX === '1';
}

export async function runCodexPrompt(options: {
  agentId: string;
  prompt: string;
  cwd: string;
}): Promise<void> {
  if (shouldSkipCodex()) {
    console.log(`[dry-run] ${options.agentId}: ${options.prompt.slice(0, 80)}...`);
    return;
  }

  await runCodex({
    profile: options.agentId,
    prompt: options.prompt,
    workingDir: options.cwd,
    onData: (chunk) => {
      try {
        process.stdout.write(chunk);
      } catch {
        // Ignore stdout write errors
      }
    },
    onErrorData: (chunk) => {
      try {
        process.stderr.write(chunk);
      } catch {
        // Ignore stderr write errors
      }
    },
  });
}

export async function runAgent(
  agentId: string,
  prompt: string,
  cwd: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  if (shouldSkipCodex()) {
    console.log(`[dry-run] ${agentId}: ${prompt.slice(0, 120)}...`);
    return '';
  }

  let buffered = '';
  const result = await runCodex({
    profile: agentId,
    prompt,
    workingDir: cwd,
    abortSignal,
    onData: (chunk) => {
      buffered += chunk;
      try {
        process.stdout.write(chunk);
      } catch {
        // Ignore stdout write errors
      }
    },
    onErrorData: (chunk) => {
      try {
        process.stderr.write(chunk);
      } catch {
        // Ignore stderr write errors
      }
    },
  });

  const stdout = result.stdout || buffered;
  try {
    const memoryDir = path.resolve(cwd, '.codemachine', 'memory');
    const adapter = new MemoryAdapter(memoryDir);
    const store = new MemoryStore(adapter);
    const slice = stdout.slice(-2000);
    await store.append({ agentId, content: slice, timestamp: new Date().toISOString() });
  } catch {
    // best-effort memory persistence
  }
  return stdout;
}
