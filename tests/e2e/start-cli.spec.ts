import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const distEntry = path.join(projectRoot, 'dist', 'index.js');
const fixturesRoot = path.join(projectRoot, 'tests', 'fixtures');
const codexFixturesDir = path.join(fixturesRoot, 'codex');
const activeProcesses = new Set<ChildProcessWithoutNullStreams>();

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const runCommand = async (
  command: string,
  args: string[],
  { cwd = projectRoot, env }: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<RunResult> => {
  return await new Promise<RunResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...(env ?? {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    activeProcesses.add(child);

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.once('error', (error) => {
      activeProcesses.delete(child);
      reject(error);
    });

    child.once('close', (code) => {
      activeProcesses.delete(child);
      resolve({ exitCode: code ?? 0, stdout, stderr });
    });
  });
};

beforeAll(async () => {
  if (!existsSync(distEntry)) {
    const buildResult = await runCommand('npm', ['run', 'build']);

    if (buildResult.exitCode !== 0) {
      throw new Error(`npm run build failed: ${buildResult.stderr || buildResult.stdout}`);
    }

    if (!buildResult.stdout.trim()) {
      throw new Error('npm run build completed without emitting output');
    }
  }
});

afterEach(() => {
  for (const child of activeProcesses) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  activeProcesses.clear();
});

describe('codemachine CLI smoke', () => {
  it('advances the planning workflow to Building', async () => {
    const result = await runCommand('node', ['dist/index.js', 'start', '--force'], {
      env: {
        CODEX_HOME: codexFixturesDir,
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Advancing Planning workflow to next phase: Building');
    expect(result.stderr.trim()).toBe('');
  }, 20_000);
});
