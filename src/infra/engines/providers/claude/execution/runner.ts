import * as path from 'node:path';
import { homedir } from 'node:os';

import { spawnProcess } from '../../../../process/spawn.js';
import { buildClaudeExecCommand } from './commands.js';
import { expandHomeDir } from '../../../../../shared/utils/index.js';
import { logger } from '../../../../../shared/logging/index.js';

export interface RunClaudeOptions {
  profile: string;
  prompt: string;
  workingDir: string;
  model?: string;
  env?: NodeJS.ProcessEnv;
  onData?: (chunk: string) => void;
  onErrorData?: (chunk: string) => void;
  abortSignal?: AbortSignal;
  timeout?: number; // Timeout in milliseconds (default: 600000ms = 10 minutes)
}

export interface RunClaudeResult {
  stdout: string;
  stderr: string;
}

const ANSI_ESCAPE_SEQUENCE = new RegExp(String.raw`\u001B\[[0-9;?]*[ -/]*[@-~]`, 'g');

/**
 * Formats a Claude stream-json line for display
 */
function formatStreamJsonLine(line: string): string | null {
  try {
    const json = JSON.parse(line);

    if (json.type === 'assistant' && json.message?.content) {
      for (const content of json.message.content) {
        if (content.type === 'text') {
          return `💬 TEXT: ${content.text}`;
        } else if (content.type === 'thinking') {
          return `🧠 THINKING: ${content.text}`;
        } else if (content.type === 'tool_use') {
          const argKeys = Object.keys(content.input || {}).join(', ');
          return `🔧 TOOL: ${content.name} | Args: ${argKeys}`;
        }
      }
    } else if (json.type === 'user' && json.message?.content) {
      for (const content of json.message.content) {
        if (content.type === 'tool_result') {
          if (content.is_error) {
            return `❌ ERROR: ${content.content}`;
          } else {
            const preview = typeof content.content === 'string'
              ? content.content.substring(0, 100) + '...'
              : JSON.stringify(content.content);
            return `✅ RESULT: ${preview}`;
          }
        }
      }
    } else if (json.type === 'result') {
      return `⏱️  Duration: ${json.duration_ms}ms | Cost: $${json.total_cost_usd} | Tokens: ${json.usage.input_tokens}in/${json.usage.output_tokens}out`;
    }

    return null;
  } catch {
    return null;
  }
}

export async function runClaude(options: RunClaudeOptions): Promise<RunClaudeResult> {
  const { profile, prompt, workingDir, model, env, onData, onErrorData, abortSignal, timeout = 600000 } = options;

  if (!profile) {
    throw new Error('runClaude requires a profile.');
  }

  if (!prompt) {
    throw new Error('runClaude requires a prompt.');
  }

  if (!workingDir) {
    throw new Error('runClaude requires a working directory.');
  }

  // Set up CLAUDE_CONFIG_DIR (shared for authentication, profile is for agent data only)
  const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR
    ? expandHomeDir(process.env.CLAUDE_CONFIG_DIR)
    : path.join(homedir(), '.codemachine', 'claude');

  const mergedEnv = {
    ...process.env,
    ...(env ?? {}),
    CLAUDE_CONFIG_DIR: claudeConfigDir,
  };

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

  const { command, args } = buildClaudeExecCommand({ profile, workingDir, prompt, model });

  logger.debug(`Claude runner - prompt length: ${prompt.length}, lines: ${prompt.split('\n').length}`);
  logger.debug(`Claude runner - args count: ${args.length}, model: ${model ?? 'default'}`);

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

            const formatted = formatStreamJsonLine(line);
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
    const errorOutput = result.stderr.trim() || result.stdout.trim() || 'no error output';
    const lines = errorOutput.split('\n').slice(0, 10);

    logger.error('Claude CLI execution failed', {
      exitCode: result.exitCode,
      error: lines.join('\n'),
      command: `${command} ${args.join(' ')}`,
    });

    throw new Error(`Claude CLI exited with code ${result.exitCode}`);
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
