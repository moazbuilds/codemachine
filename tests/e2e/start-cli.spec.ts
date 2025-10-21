import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const distEntry = path.join(projectRoot, 'dist', 'index.js');
const fixturesRoot = path.join(projectRoot, 'tests', 'fixtures');
const engineFixturesDir = path.join(fixturesRoot, 'codex');
const activeProcesses = new Set<ChildProcess>();

const ANSI_ESCAPE_REGEX = new RegExp(String.raw`\u001B\[[0-9;?]*[ -/]*[@-~]`, 'g');
const stripAnsi = (value: string): string => value.replace(ANSI_ESCAPE_REGEX, '');

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  captureStdoutWithRedirect?: boolean;
}

const runCommand = async (
  command: string,
  args: string[],
  { cwd = projectRoot, env, captureStdoutWithRedirect = false }: RunCommandOptions = {},
): Promise<RunResult> => {
  if (captureStdoutWithRedirect) {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'codemachine-cli-'));
    const stdoutPath = path.join(tempDir, 'stdout.log');
    const stderrPath = path.join(tempDir, 'stderr.log');
    const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;
    const commandString = [command, ...args].map(quote).join(' ');
    const shellCommand = `${commandString} 1> ${quote(stdoutPath)} 2> ${quote(stderrPath)}`;

    const cleanup = async () => {
      await rm(tempDir, { recursive: true, force: true });
    };

    return await new Promise<RunResult>((resolve, reject) => {
      const child = spawn('bash', ['-lc', shellCommand], {
        cwd,
        env: {
          ...process.env,
          ...(env ?? {}),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      activeProcesses.add(child);

      child.once('error', async (error) => {
        activeProcesses.delete(child);
        await cleanup().catch(() => {});
        reject(error);
      });

      child.once('close', async (code) => {
        activeProcesses.delete(child);

        try {
          const [stdout, stderr] = await Promise.all([
            readFile(stdoutPath, 'utf8').catch(() => ''),
            readFile(stderrPath, 'utf8').catch(() => ''),
          ]);
          resolve({ exitCode: code ?? 0, stdout, stderr });
        } catch (error) {
          reject(error);
        } finally {
          await cleanup().catch(() => {});
        }
      });
    });
  }

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
  it('shows the interactive start menu', async () => {
    const result = await runCommand('node', ['dist/index.js'], {
      env: {
        CODEX_HOME: engineFixturesDir,
      },
      captureStdoutWithRedirect: true,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('CodeMachine - Multi-Agent Workflow Orchestration');
    expect(result.stdout).toContain('/start:');
    expect(result.stdout).toContain('Run configured workflow queue');
    expect(stripAnsi(result.stderr).trim()).toBe('');
  }, 20_000);
});
