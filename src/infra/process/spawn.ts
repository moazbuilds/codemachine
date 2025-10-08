import crossSpawn from 'cross-spawn';

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

export function spawnProcess(options: SpawnOptions): Promise<SpawnResult> {
  const { command, args = [], cwd, env, onStdout, onStderr, signal, stdioMode = 'pipe', timeout, stdinInput } = options;

  return new Promise((resolve, reject) => {
    // Use cross-spawn which properly handles .cmd files on Windows without shell issues
    // It automatically finds .cmd wrappers and handles argument escaping correctly
    const child = crossSpawn(command, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: stdioMode === 'inherit' ? ['ignore', 'inherit', 'inherit'] : ['pipe', 'pipe', 'pipe'],
      signal,
      timeout,
    });

    // Write to stdin if data is provided
    if (stdinInput && child.stdin) {
      child.stdin.write(stdinInput);
      child.stdin.end();
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
      reject(error);
    });

    child.once('close', (code: number | null) => {
      const exitCode = code ?? 0;
      resolve({
        exitCode,
        stdout: stdoutChunks.join(''),
        stderr: stderrChunks.join(''),
      });
    });
  });
}
