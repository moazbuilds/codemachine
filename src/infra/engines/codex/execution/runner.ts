import * as path from 'node:path';
import { homedir } from 'node:os';

import { spawnProcess } from '../../../process/spawn.js';
import { buildCodexExecCommand } from './commands.js';
import { expandHomeDir } from '../../../../shared/utils/index.js';
import { logger } from '../../../../shared/logging/index.js';

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

/**
 * Formats a Codex stream-json line for display
 */
function formatCodexStreamJsonLine(line: string): string | null {
  try {
    const json = JSON.parse(line);

    // Handle reasoning items (thinking)
    if (json.type === 'item.completed' && json.item?.type === 'reasoning') {
      return `🧠 THINKING: ${json.item.text}`;
    }

    // Handle command execution
    if (json.type === 'item.started' && json.item?.type === 'command_execution') {
      return `🔧 COMMAND: ${json.item.command}`;
    }

    if (json.type === 'item.completed' && json.item?.type === 'command_execution') {
      const exitCode = json.item.exit_code ?? 0;
      if (exitCode === 0) {
        const preview = json.item.aggregated_output
          ? json.item.aggregated_output.substring(0, 100) + '...'
          : '';
        return `✅ COMMAND RESULT: ${preview}`;
      } else {
        return `❌ COMMAND FAILED: Exit code ${exitCode}`;
      }
    }

    // Handle agent messages
    if (json.type === 'item.completed' && json.item?.type === 'agent_message') {
      return `💬 MESSAGE: ${json.item.text}`;
    }

    // Handle turn/thread lifecycle events (skip these)
    if (json.type === 'thread.started' || json.type === 'turn.started' || json.type === 'turn.completed') {
      // Show usage info at turn completion
      if (json.type === 'turn.completed' && json.usage) {
        const { input_tokens, cached_input_tokens, output_tokens } = json.usage;
        const totalIn = input_tokens + (cached_input_tokens || 0);
        return `⏱️  Tokens: ${totalIn}in/${output_tokens}out${cached_input_tokens ? ` (${cached_input_tokens} cached)` : ''}`;
      }
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

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
  // Example (Linux/Mac):
  //   CODEX_HOME="$HOME/.codemachine/codex" codex exec \
  //     --profile <profile> --skip-git-repo-check \
  //     --sandbox danger-full-access --dangerously-bypass-approvals-and-sandbox \
  //     -C <workingDir> "<composite prompt>"

  // Expand platform-specific home directory variables in CODEX_HOME
  const codexHome = process.env.CODEX_HOME
    ? expandHomeDir(process.env.CODEX_HOME)
    : path.join(homedir(), '.codemachine', 'codex');
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

  const { command, args } = buildCodexExecCommand({ profile, workingDir, prompt });

  logger.debug(`Codex runner - prompt length: ${prompt.length}, lines: ${prompt.split('\n').length}`);
  logger.debug(`Codex runner - args count: ${args.length}`);

  const result = await spawnProcess({
    command,
    args,
    cwd: workingDir,
    env: mergedEnv,
    stdinInput: prompt, // Pass prompt via stdin instead of command-line argument
    onStdout: inheritTTY
      ? undefined
      : (chunk) => {
          const out = normalize(chunk);

          // Format and display each JSON line
          const lines = out.trim().split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;

            const formatted = formatCodexStreamJsonLine(line);
            if (formatted) {
              onData?.(formatted + '\n');
            }
          }
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
