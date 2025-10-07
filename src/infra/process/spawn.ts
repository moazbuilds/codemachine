import { spawn } from 'node:child_process';
import { platform } from 'node:os';

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
}

export interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function spawnProcess(options: SpawnOptions): Promise<SpawnResult> {
  const { command, args = [], cwd, env, onStdout, onStderr, signal, stdioMode = 'pipe', timeout } = options;

  return new Promise((resolve, reject) => {
    // On Windows, we need shell: true for .cmd files, but this requires proper argument handling
    // Node.js child_process.spawn handles argument escaping correctly even with shell: true
    const isWindows = process.platform === 'win32';

    const child = spawn(command, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: stdioMode === 'inherit' ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'pipe', 'pipe'],
      signal,
      timeout,
      shell: isWindows,
      windowsVerbatimArguments: false, // Ensure proper quoting on Windows
    });

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

    child.once('error', (error) => {
      reject(error);
    });

    child.once('close', (code) => {
      const exitCode = code ?? 0;
      resolve({
        exitCode,
        stdout: stdoutChunks.join(''),
        stderr: stderrChunks.join(''),
      });
    });
  });
}
