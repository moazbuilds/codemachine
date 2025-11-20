<<<<<<< HEAD
import crossSpawn from 'cross-spawn';
import type { ChildProcess } from 'child_process';
=======
import type { Subprocess } from 'bun';
>>>>>>> origin/main
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
<<<<<<< HEAD
const activeProcesses = new Set<ChildProcess>();
=======
const activeProcesses = new Set<Subprocess>();

function resolveCommandExecutable(command: string): string {
  // If command already specifies a path (relative or absolute), use it as-is
  const hasPathSeparator = command.includes('/') || command.includes('\\');
  if (hasPathSeparator) {
    return command;
  }

  const resolved = (() => {
    try {
      return Bun.which(command) ?? undefined;
    } catch {
      return undefined;
    }
  })();

  if (resolved) {
    return resolved;
  }

  if (command === 'bun' && typeof process.execPath === 'string' && process.execPath.length > 0) {
    return process.execPath;
  }

  return command;
}
>>>>>>> origin/main

/**
 * Kill all active child processes
 * Called during cleanup to ensure no orphaned processes
 */
export function killAllActiveProcesses(): void {
  for (const child of activeProcesses) {
    try {
<<<<<<< HEAD
      if (!child.killed) {
        child.kill('SIGTERM');
        // Force kill after 1 second if still running
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 1000);
      }
=======
      child.kill('SIGTERM');
      // Force kill after 1 second if still running
      setTimeout(() => {
        try {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        } catch {
          // Process already dead
        }
      }, 1000);
>>>>>>> origin/main
    } catch {
      // Ignore errors during cleanup
    }
  }
  activeProcesses.clear();
}

export function spawnProcess(options: SpawnOptions): Promise<SpawnResult> {
  const { command, args = [], cwd, env, onStdout, onStderr, signal, stdioMode = 'pipe', timeout, stdinInput } = options;

  // Pre-encode stdin upfront if provided. We avoid manual piping because Bun's FileSink
  // requires flush semantics that were dropping data in practice.
  const stdinEncoded = stdinInput !== undefined
    ? new TextEncoder().encode(stdinInput)
    : undefined;

  return new Promise((resolve, reject) => {
    // Track if process was aborted to handle close event correctly
    let wasAborted = false;
<<<<<<< HEAD

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
=======
    let timeoutId: Timer | undefined;
    let abortReason: Error | undefined;

    // Use external signal directly or create internal one for timeout only
    // This eliminates the double AbortController layer for faster abort propagation
    const timeoutController = !signal && timeout ? new AbortController() : undefined;
    const effectiveSignal = signal || timeoutController?.signal;

    // Handle timeout
    if (timeout && timeoutController) {
      timeoutId = setTimeout(() => {
        logger.debug(`Process ${command} timed out after ${timeout}ms`);
        abortReason = new Error(`Process timed out after ${timeout}ms`);
        timeoutController.abort(abortReason);
      }, timeout);
    }

    // Spawn the process using Bun.spawn()
    // Bun automatically handles .cmd files on Windows (like cross-spawn)
    const executable = resolveCommandExecutable(command);
    const child = Bun.spawn([executable, ...args], {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      // When inheriting stdio, inherit stdin too (needed for interactive TUI apps like Ink)
      stdin: stdinEncoded ?? (stdioMode === 'inherit' ? 'inherit' : 'ignore'),
      stdout: stdioMode === 'inherit' ? 'inherit' : 'pipe',
      stderr: stdioMode === 'inherit' ? 'inherit' : 'pipe',
      // Note: Bun doesn't have detached option, but we can still kill process groups manually
>>>>>>> origin/main
    });

    // Track this child process for cleanup
    activeProcesses.add(child);

    // Remove from tracking when process exits
    const removeFromTracking = () => {
      activeProcesses.delete(child);
<<<<<<< HEAD
    };

    // Handle abort signal explicitly (in case cross-spawn doesn't handle it properly)
    if (signal) {
      const abortHandler = () => {
        logger.debug(`Abort handler called for ${command} (PID: ${child.pid}, killed: ${child.killed})`);
        wasAborted = true;

        // For detached processes (CCR, Claude, etc.), we MUST kill the process group
        // even if child.killed is true, because Node.js's built-in handler
        // only kills the main process, leaving child processes running
=======
      if (timeoutId) clearTimeout(timeoutId);
    };

    // Handle abort signal directly (no double controller layer for faster propagation)
    if (effectiveSignal) {
      const abortHandler = () => {
        logger.debug(`Abort handler called for ${command} (PID: ${child.pid}, killed: ${child.killed})`);
        wasAborted = true;
        abortReason = effectiveSignal.reason || new Error('Process aborted');

        // Kill process group on Unix (for wrapper scripts like CCR)
>>>>>>> origin/main
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
<<<<<<< HEAD
            // Fallback to killing just the process if process group kill fails
=======
            // Fallback to killing just the process
>>>>>>> origin/main
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
<<<<<<< HEAD
              if (!child.killed) {
                logger.debug(`Force killing process ${command} with SIGKILL`);
                child.kill('SIGKILL');
=======
              try {
                if (!child.killed) {
                  logger.debug(`Force killing process ${command} with SIGKILL`);
                  child.kill('SIGKILL');
                }
              } catch {
                // Process already dead
>>>>>>> origin/main
              }
            }, 100);
          } catch {
            // Ignore kill errors
          }
        } else {
          logger.debug(`Process ${command} already killed, skipping manual kill`);
        }
      };

<<<<<<< HEAD
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
=======
      if (effectiveSignal.aborted) {
        abortHandler();
      } else {
        effectiveSignal.addEventListener('abort', abortHandler, { once: true });
>>>>>>> origin/main
      }
    }

    // Handle stdout/stderr streaming for pipe mode
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    (async () => {
      try {
        // Stream stdout and stderr in parallel
        const streamPromises: Promise<void>[] = [];

        if (stdioMode === 'pipe' && child.stdout) {
          streamPromises.push(
            (async () => {
              const reader = child.stdout!.getReader();
              const decoder = new TextDecoder();

<<<<<<< HEAD
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
=======
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                stdoutChunks.push(text);
                onStdout?.(text);
              }
            })()
          );
        }

        if (stdioMode === 'pipe' && child.stderr) {
          streamPromises.push(
            (async () => {
              const reader = child.stderr!.getReader();
              const decoder = new TextDecoder();

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                stderrChunks.push(text);
                onStderr?.(text);
              }
            })()
          );
        }

        // Wait for all streams and process exit in parallel
        const [exitCode] = await Promise.all([
          child.exited,
          ...streamPromises
        ]);

        logger.debug(`Process exit for ${command} (PID: ${child.pid}), code: ${exitCode}, wasAborted: ${wasAborted}`);
        removeFromTracking();

        // If process was aborted, reject the promise
        if (wasAborted) {
          logger.debug(`Process ${command} was aborted, rejecting with AbortError`);
          reject(abortReason || new Error('Process aborted'));
          return;
        }

        resolve({
          exitCode,
          stdout: stdoutChunks.join(''),
          stderr: stderrChunks.join(''),
        });
      } catch (error) {
        logger.debug(`Process error for ${command}: ${error instanceof Error ? error.message : String(error)}`);
        removeFromTracking();
        reject(error);
      }
    })();
>>>>>>> origin/main
  });
}
