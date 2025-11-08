import crossSpawn from 'cross-spawn';
import type { ChildProcess } from 'child_process';
import * as logger from '../../shared/logging/logger.js';

export interface SpawnOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  signal?: AbortSignal;
  stdioMode?: 'pipe' | 'inherit';
  timeout?: number; // Timeout in milliseconds
  stdinInput?: string; // Data to write to stdin
}

export interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Global registry of active child processes
 * Used to ensure proper cleanup on process termination
 */
const activeProcesses = new Set<ChildProcess>();

/**
 * Kill all active child processes
 * Called during cleanup to ensure no orphaned processes
 */
export function killAllActiveProcesses(): void {
  for (const child of activeProcesses) {
    try {
      if (!child.killed) {
        child.kill('SIGTERM');
        // Force kill after 1 second if still running
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 1000);
      }
    } catch {
      // Ignore errors during cleanup
    }
  }
  activeProcesses.clear();
}

export function spawnProcess(options: SpawnOptions): Promise<SpawnResult> {
  const { command, args = [], cwd, env, onStdout, onStderr, signal, stdioMode = 'pipe', timeout, stdinInput } = options;

  return new Promise((resolve, reject) => {
    // Track if process was aborted to handle close event correctly
    let wasAborted = false;

    // Use cross-spawn which properly handles .cmd files on Windows without shell issues
    // It automatically finds .cmd wrappers and handles argument escaping correctly
    const child = crossSpawn(command, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: stdioMode === 'inherit' ? ['ignore', 'inherit', 'inherit'] : ['pipe', 'pipe', 'pipe'],
      signal,
      timeout,
      // Spawn in new process group on Unix to enable killing all children together
      // This is critical for Node.js wrapper scripts (like CCR) that spawn subprocesses
      ...(process.platform !== 'win32' ? { detached: true } : {}),
    });

    // Track this child process for cleanup
    activeProcesses.add(child);

    // Remove from tracking when process exits
    const removeFromTracking = () => {
      activeProcesses.delete(child);
    };

    // Handle abort signal explicitly (in case cross-spawn doesn't handle it properly)
    if (signal) {
      const abortHandler = () => {
        logger.debug(`Abort handler called for ${command} (PID: ${child.pid}, killed: ${child.killed})`);
        wasAborted = true;

        // For detached processes (CCR, Claude, etc.), we MUST kill the process group
        // even if child.killed is true, because Node.js's built-in handler
        // only kills the main process, leaving child processes running
        if (process.platform !== 'win32' && child.pid) {
          try {
            // Kill process group (negative PID kills the entire group)
            logger.debug(`Killing process group -${child.pid} with SIGTERM`);
            process.kill(-child.pid, 'SIGTERM');

            // Force kill after 100ms if still running
            setTimeout(() => {
              try {
                logger.debug(`Force killing process group -${child.pid} with SIGKILL`);
                process.kill(-child.pid!, 'SIGKILL');
              } catch (err) {
                // Process group already dead, ignore
                logger.debug(`Force kill failed (process already dead): ${err instanceof Error ? err.message : String(err)}`);
              }
            }, 100);
          } catch (err) {
            // Fallback to killing just the process if process group kill fails
            logger.debug(`Process group kill failed, falling back to child.kill(): ${err instanceof Error ? err.message : String(err)}`);
            if (!child.killed) {
              child.kill('SIGTERM');
            }
          }
        } else if (!child.killed) {
          // Windows or no PID: use child.kill()
          logger.debug(`Killing process ${command} (PID: ${child.pid}) with child.kill()`);
          try {
            child.kill('SIGTERM');
            // Force kill after 100ms if still running
            setTimeout(() => {
              if (!child.killed) {
                logger.debug(`Force killing process ${command} with SIGKILL`);
                child.kill('SIGKILL');
              }
            }, 100);
          } catch {
            // Ignore kill errors
          }
        } else {
          logger.debug(`Process ${command} already killed, skipping manual kill`);
        }
      };

      // Check if already aborted before adding listener
      if (signal.aborted) {
        abortHandler();
      } else {
        signal.addEventListener('abort', abortHandler, { once: true });
      }
    }

    // Write to stdin if data is provided
    if (child.stdin) {
      if (stdinInput !== undefined) {
        child.stdin.end(stdinInput);
      } else if (stdioMode === 'pipe') {
        child.stdin.end();
      }
    }

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    if (stdioMode === 'pipe' && child.stdout) {
      child.stdout.on('data', (data: Buffer | string) => {
        const text = data.toString();
        stdoutChunks.push(text);
        onStdout?.(text);
      });
    }

    if (stdioMode === 'pipe' && child.stderr) {
      child.stderr.on('data', (data: Buffer | string) => {
        const text = data.toString();
        stderrChunks.push(text);
        onStderr?.(text);
      });
    }

    child.once('error', (error: Error) => {
      // If this is an AbortError from the signal, don't reject yet
      // Wait for the close event which will properly handle the abortion
      // This prevents a race condition where error fires before abort handler runs
      if (error.name === 'AbortError') {
        logger.debug(`Process error event (AbortError) for ${command}, waiting for close event`);
        return;
      }

      logger.debug(`Process error event for ${command}: ${error.message}`);
      removeFromTracking();
      reject(error);
    });

    child.once('close', (code: number | null) => {
      logger.debug(`Process close event for ${command} (PID: ${child.pid}), code: ${code}, wasAborted: ${wasAborted}`);
      removeFromTracking();

      // If process was aborted, reject the promise instead of resolving
      if (wasAborted) {
        // Reject with the abort reason (which is an AbortError DOMException)
        // This ensures the error name is 'AbortError' and will be caught correctly by the workflow
        logger.debug(`Process ${command} was aborted, rejecting with AbortError`);
        reject(signal?.reason || new Error('Process aborted'));
        return;
      }

      const exitCode = code ?? 0;
      resolve({
        exitCode,
        stdout: stdoutChunks.join(''),
        stderr: stderrChunks.join(''),
      });
    });
  });
}
