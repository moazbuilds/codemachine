import * as path from 'node:path';
import { homedir } from 'node:os';

import { spawnProcess } from '../../../../process/spawn.js';
import { buildCursorExecCommand } from './commands.js';
import { metadata } from '../metadata.js';
import { expandHomeDir } from '../../../../../shared/utils/index.js';
import { logger } from '../../../../../shared/logging/index.js';

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

/**
 * Formats a Cursor stream-json line for display
 */
function formatStreamJsonLine(line: string): string | null {
  try {
    const json = JSON.parse(line);

    // Handle root-level tool_call messages
    if (json.type === 'tool_call') {
      if (json.subtype === 'started') {
        // Extract tool name from the tool_call object
        const toolCall = json.tool_call;
        const toolName = Object.keys(toolCall).find(key => key.endsWith('ToolCall'));
        const displayName = toolName ? toolName.replace('ToolCall', '') : 'unknown';

        // Extract additional context from args
        const toolData = toolCall[toolName as string];
        const args = toolData?.args || {};
        let context = '';

        // Add relevant args based on tool type
        if (args.path) {
          const pathParts = args.path.split('/');
          const shortPath = pathParts.length > 3
            ? `.../${pathParts.slice(-2).join('/')}`
            : args.path;
          context = ` ${shortPath}`;
        } else if (args.file_path) {
          const pathParts = args.file_path.split('/');
          const shortPath = pathParts.length > 3
            ? `.../${pathParts.slice(-2).join('/')}`
            : args.file_path;
          context = ` ${shortPath}`;
        } else if (args.pattern) {
          context = ` "${args.pattern}"`;
        }

        return `🔧 TOOL STARTED: ${displayName}${context}`;
      } else if (json.subtype === 'completed') {
        const toolCall = json.tool_call;
        const toolName = Object.keys(toolCall).find(key => key.endsWith('ToolCall'));
        const displayName = toolName ? toolName.replace('ToolCall', '') : 'unknown';

        // Extract additional context from args
        const toolData = toolCall[toolName as string];
        const args = toolData?.args || {};
        let context = '';

        if (args.path) {
          const pathParts = args.path.split('/');
          const shortPath = pathParts.length > 3
            ? `.../${pathParts.slice(-2).join('/')}`
            : args.path;
          context = ` ${shortPath}`;
        } else if (args.file_path) {
          const pathParts = args.file_path.split('/');
          const shortPath = pathParts.length > 3
            ? `.../${pathParts.slice(-2).join('/')}`
            : args.file_path;
          context = ` ${shortPath}`;
        } else if (args.pattern) {
          context = ` "${args.pattern}"`;
        }

        return `✅ TOOL COMPLETED: ${displayName}${context}`;
      }
    }

    // Handle assistant messages
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

  logger.debug(`Cursor runner - prompt length: ${prompt.length}, lines: ${prompt.split('\n').length}`);
  logger.debug(`Cursor runner - args count: ${args.length}, model: ${model ?? 'auto'}`);

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
      logger.error(`${name} CLI not found when executing: ${full}`);
      throw new Error(`'${command}' is not available on this system. Please install ${name} first:\n  ${install}`);
    }
    throw error;
  }

  if (result.exitCode !== 0) {
    const errorOutput = result.stderr.trim() || result.stdout.trim() || 'no error output';
    const lines = errorOutput.split('\n').slice(0, 10);

    logger.error('Cursor CLI execution failed', {
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
