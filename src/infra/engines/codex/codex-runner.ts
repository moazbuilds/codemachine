import * as path from 'node:path';
import { homedir } from 'node:os';

import { spawnProcess } from '../../process/spawn.js';

export interface RunCodexOptions {
  profile: string;
  prompt: string;
  workingDir: string;
  env?: NodeJS.ProcessEnv;
  onData?: (chunk: string) => void;
  onErrorData?: (chunk: string) => void;
  abortSignal?: AbortSignal;
  timeout?: number; // Timeout in milliseconds (default: 600000ms = 10 minutes)
}

export interface RunCodexResult {
  stdout: string;
  stderr: string;
}

const ANSI_ESCAPE_SEQUENCE = new RegExp(String.raw`\u001B\[[0-9;?]*[ -/]*[@-~]`, 'g');

export async function runCodex(options: RunCodexOptions): Promise<RunCodexResult> {
  const { profile, prompt, workingDir, env, onData, onErrorData, abortSignal, timeout = 600000 } = options;

  if (!profile) {
    throw new Error('runCodex requires a profile.');
  }

  if (!prompt) {
    throw new Error('runCodex requires a prompt.');
  }

  if (!workingDir) {
    throw new Error('runCodex requires a working directory.');
  }

  // Prefer calling the real Codex CLI directly, mirroring runner-prompts spec
  // Example:
  //   CODEX_HOME="$HOME/.codemachine/codex" codex exec \
  //     --profile <profile> --skip-git-repo-check \
  //     --sandbox danger-full-access --dangerously-bypass-approvals-and-sandbox \
  //     -C <workingDir> "<composite prompt>"

  const codexHome = process.env.CODEX_HOME || path.join(homedir(), '.codemachine', 'codex');
  const mergedEnv = { ...process.env, ...(env ?? {}), CODEX_HOME: codexHome };

  const plainLogs = (process.env.CODEMACHINE_PLAIN_LOGS || '').toString() === '1';
  // Force pipe mode to ensure text normalization is applied
  const inheritTTY = false;

  const normalize = (text: string): string => {
    // Simple but effective approach to fix carriage return wrapping issues
    let result = text;

    // Handle carriage returns that cause line overwrites
    // When we see \r followed by text, it means the text should overwrite what came before
    // So we keep only the text after the last \r in each line
    result = result.replace(/^.*\r([^\r\n]*)/gm, '$1');

    if (plainLogs) {
      // Plain mode: strip all ANSI sequences
      result = result.replace(ANSI_ESCAPE_SEQUENCE, '');
    }

    // Clean up line endings
    result = result
      .replace(/\r\n/g, '\n')  // Convert CRLF to LF
      .replace(/\r/g, '\n')    // Convert remaining CR to LF
      .replace(/\n{3,}/g, '\n\n'); // Collapse excessive newlines

    return result;
  };
  const result = await spawnProcess({
    command: 'codex',
    args: [
      'exec',
      '--profile',
      profile,
      '--skip-git-repo-check',
      '--sandbox',
      'danger-full-access',
      '--dangerously-bypass-approvals-and-sandbox',
      '-C',
      workingDir,
      prompt,
    ],
    cwd: workingDir,
    env: mergedEnv,
    onStdout: inheritTTY
      ? undefined
      : (chunk) => {
          const out = normalize(chunk);
          onData?.(out);
        },
    onStderr: inheritTTY
      ? undefined
      : (chunk) => {
          const out = normalize(chunk);
          onErrorData?.(out);
        },
    signal: abortSignal,
    stdioMode: inheritTTY ? 'inherit' : 'pipe',
    timeout,
  });

  if (result.exitCode !== 0) {
    const snippet = result.stderr.trim().split('\n')[0]?.slice(0, 200) ?? 'no stderr output';
    throw new Error(`Codex CLI exited with code ${result.exitCode}: ${snippet}`);
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
