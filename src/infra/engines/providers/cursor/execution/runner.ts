import * as path from 'node:path';
import { homedir } from 'node:os';

import { spawnProcess } from '../../../../process/spawn.js';
import { buildCursorExecCommand } from './commands.js';
import { metadata } from '../metadata.js';
import { expandHomeDir } from '../../../../../shared/utils/index.js';
import { formatThinking, formatCommand, formatResult } from '../../../../../shared/formatters/outputMarkers.js';

export interface RunCursorOptions {
  prompt: string;
  workingDir: string;
  model?: string;
  env?: NodeJS.ProcessEnv;
  onData?: (chunk: string) => void;
  onErrorData?: (chunk: string) => void;
  abortSignal?: AbortSignal;
  timeout?: number; // Timeout in milliseconds (default: 1800000ms = 30 minutes)
}

export interface RunCursorResult {
  stdout: string;
  stderr: string;
}

const ANSI_ESCAPE_SEQUENCE = new RegExp(String.raw`\u001B\[[0-9;?]*[ -/]*[@-~]`, 'g');

// Track tool names for associating with results
const toolNameMap = new Map<string, string>();

/**
 * Formats a Cursor stream-json line for display
 */
function formatStreamJsonLine(line: string): string | null {
  try {
    const json = JSON.parse(line);

    // Handle root-level tool_call messages
    if (json.type === 'tool_call') {
      if (json.subtype === 'started') {
        // Don't show on start - will show with final color when tool_result arrives
        return null;
      } else if (json.subtype === 'completed') {
        // Skip completed events - the result will be shown via tool_result
        return null;
      }
    }

    // Handle assistant messages
    if (json.type === 'assistant' && json.message?.content) {
      for (const content of json.message.content) {
        if (content.type === 'text') {
          return content.text;
        } else if (content.type === 'thinking') {
          return formatThinking(content.text);
        } else if (content.type === 'tool_use') {
          // Track tool name for later use with result
          if (content.id && content.name) {
            toolNameMap.set(content.id, content.name);
          }
          // Don't show on start - will show with final color when result arrives
          return null;
        }
      }
    } else if (json.type === 'user' && json.message?.content) {
      for (const content of json.message.content) {
        if (content.type === 'tool_result') {
          // Get tool name from map
          const toolName = content.tool_use_id ? toolNameMap.get(content.tool_use_id) : undefined;
          const commandName = toolName || 'tool';

          // Clean up the map entry
          if (content.tool_use_id) {
            toolNameMap.delete(content.tool_use_id);
          }

          let preview: string;
          if (content.is_error) {
            preview = typeof content.content === 'string' ? content.content : JSON.stringify(content.content);
            // Show command in red with nested error
            return formatCommand(commandName, 'error') + '\n' + formatResult(preview, true);
          } else {
            if (typeof content.content === 'string') {
              const trimmed = content.content.trim();
              preview = trimmed
                ? (trimmed.length > 100 ? trimmed.substring(0, 100) + '...' : trimmed)
                : 'empty';
            } else {
              preview = JSON.stringify(content.content);
            }
            // Show command in green with nested result
            return formatCommand(commandName, 'success') + '\n' + formatResult(preview, false);
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

export async function runCursor(options: RunCursorOptions): Promise<RunCursorResult> {
  const { prompt, workingDir, model, env, onData, onErrorData, abortSignal, timeout = 1800000 } = options;

  if (!prompt) {
    throw new Error('runCursor requires a prompt.');
  }

  if (!workingDir) {
    throw new Error('runCursor requires a working directory.');
  }

  // Set up CURSOR_CONFIG_DIR for authentication
  const cursorConfigDir = process.env.CURSOR_CONFIG_DIR
    ? expandHomeDir(process.env.CURSOR_CONFIG_DIR)
    : path.join(homedir(), '.codemachine', 'cursor');

  const mergedEnv = {
    ...process.env,
    ...(env ?? {}),
    CURSOR_CONFIG_DIR: cursorConfigDir,
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

  const { command, args } = buildCursorExecCommand({
    workingDir,
    prompt,
    model,
    cursorConfigDir
  });

  // Debug logging only when LOG_LEVEL=debug
  if (process.env.LOG_LEVEL === 'debug') {
    console.error(`[DEBUG] Cursor runner - prompt length: ${prompt.length}, lines: ${prompt.split('\n').length}`);
    console.error(`[DEBUG] Cursor runner - args count: ${args.length}, model: ${model ?? 'auto'}`);
  }

  let result;
  try {
    result = await spawnProcess({
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

          // Check for common Cursor errors and provide helpful messages
          if (out.includes('ConnectError: [invalid_argument]') || out.includes('Error =')) {
            onErrorData?.('⚠️  Cursor Error: This is commonly related to plan mode. You may need to check if you\'re in plan mode to use pro models.\n');
          }

          onErrorData?.(out);
        },
    signal: abortSignal,
    stdioMode: inheritTTY ? 'inherit' : 'pipe',
      timeout,
    });
  } catch (error) {
    const err = error as unknown as { code?: string; message?: string };
    const message = err?.message ?? '';
    const notFound = err?.code === 'ENOENT' || /not recognized as an internal or external command/i.test(message) || /command not found/i.test(message);
    if (notFound) {
      const full = `${command} ${args.join(' ')}`.trim();
      const install = metadata.installCommand;
      const name = metadata.name;
      console.error(`[ERROR] ${name} CLI not found when executing: ${full}`);
      throw new Error(`'${command}' is not available on this system. Please install ${name} first:\n  ${install}`);
    }
    throw error;
  }

  if (result.exitCode !== 0) {
    const errorOutput = result.stderr.trim() || result.stdout.trim() || 'no error output';
    const lines = errorOutput.split('\n').slice(0, 10);

    console.error('[ERROR] Cursor CLI execution failed', {
      exitCode: result.exitCode,
      error: lines.join('\n'),
      command: `${command} ${args.join(' ')}`,
    });

    throw new Error(`Cursor CLI exited with code ${result.exitCode}`);
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
