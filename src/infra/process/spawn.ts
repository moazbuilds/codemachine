import type { Subprocess } from 'bun';
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
const activeProcesses = new Set<Subprocess>();

/**
 * Kill all active child processes
 * Called during cleanup to ensure no orphaned processes
 */
export function killAllActiveProcesses(): void {
  for (const child of activeProcesses) {
    try {
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
    let timeoutId: Timer | undefined;

    // Create combined abort controller for timeout + external signal
    const controller = new AbortController();
    const internalSignal = controller.signal;

    // Handle timeout
    if (timeout) {
      timeoutId = setTimeout(() => {
        logger.debug(`Process ${command} timed out after ${timeout}ms`);
        controller.abort(new Error(`Process timed out after ${timeout}ms`));
      }, timeout);
    }

    // Forward external abort signal to internal controller
    if (signal) {
      const abortHandler = () => {
        logger.debug(`External abort signal received for ${command}`);
        wasAborted = true;
        controller.abort(signal.reason || new Error('Process aborted'));
      };

      if (signal.aborted) {
        abortHandler();
      } else {
        signal.addEventListener('abort', abortHandler, { once: true });
      }
    }

    // Spawn the process using Bun.spawn()
    // Bun automatically handles .cmd files on Windows (like cross-spawn)
    const child = Bun.spawn([command, ...args], {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdin: stdinEncoded ?? 'ignore',
      stdout: stdioMode === 'inherit' ? 'inherit' : 'pipe',
      stderr: stdioMode === 'inherit' ? 'inherit' : 'pipe',
      // Note: Bun doesn't have detached option, but we can still kill process groups manually
    });

    // Track this child process for cleanup
    activeProcesses.add(child);

    // Remove from tracking when process exits
    const removeFromTracking = () => {
      activeProcesses.delete(child);
      if (timeoutId) clearTimeout(timeoutId);
    };

    // Handle internal abort signal (from timeout or external abort)
    internalSignal.addEventListener('abort', () => {
      logger.debug(`Abort handler called for ${command} (PID: ${child.pid}, killed: ${child.killed})`);
      wasAborted = true;

      // Kill process group on Unix (for wrapper scripts like CCR)
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
          // Fallback to killing just the process
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
            try {
              if (!child.killed) {
                logger.debug(`Force killing process ${command} with SIGKILL`);
                child.kill('SIGKILL');
              }
            } catch {
              // Process already dead
            }
          }, 100);
        } catch {
          // Ignore kill errors
        }
      } else {
        logger.debug(`Process ${command} already killed, skipping manual kill`);
      }
    }, { once: true });

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
          reject(internalSignal.reason || new Error('Process aborted'));
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
  });
}
