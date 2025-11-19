import { stat, rm, writeFile, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

import { expandHomeDir } from '../../../../shared/utils/index.js';
import { metadata } from './metadata.js';

/**
 * Resolves the Codex home directory
 */
async function resolveCodexHome(codexHome?: string): Promise<string> {
  const rawPath = codexHome ?? process.env.CODEX_HOME ?? path.join(homedir(), '.codemachine', 'codex');
  const targetHome = expandHomeDir(rawPath);
  await mkdir(targetHome, { recursive: true });
  return targetHome;
}

/**
 * Check if CLI is installed
 */
async function isCliInstalled(command: string): Promise<boolean> {
  try {
    // Resolve command using Bun.which() to handle Windows .cmd files
    const resolvedCommand = Bun.which(command) ?? command;

    const proc = Bun.spawn([resolvedCommand, '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'ignore',
    });

    // Set a timeout
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 3000)
    );

    const exitCode = await Promise.race([proc.exited, timeout]);
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const out = `${stdout}\n${stderr}`;

    if (typeof exitCode === 'number' && exitCode === 0) return true;
    if (/not recognized as an internal or external command/i.test(out)) return false;
    if (/command not found/i.test(out)) return false;
    if (/No such file or directory/i.test(out)) return false;
    return false;
  } catch {
    return false;
  }
}

export function getAuthFilePath(codexHome: string): string {
  return path.join(codexHome, 'auth.json');
}

export async function isAuthenticated(): Promise<boolean> {
  const codexHome = await resolveCodexHome();
  const authPath = getAuthFilePath(codexHome);
  try {
    await stat(authPath);
    return true;
  } catch (_error) {
    return false;
  }
}

export async function ensureAuth(): Promise<boolean> {
  const codexHome = await resolveCodexHome();
  const authPath = getAuthFilePath(codexHome);

  // If already authenticated, nothing to do.
  try {
    await stat(authPath);
    return true;
  } catch {
    // Auth file doesn't exist
  }

  if (process.env.CODEMACHINE_SKIP_AUTH === '1') {
    await writeFile(authPath, '{}', { encoding: 'utf8' });
    return true;
  }

  // Check if CLI is installed
  const cliInstalled = await isCliInstalled(metadata.cliBinary);
  if (!cliInstalled) {
    console.error(`\n────────────────────────────────────────────────────────────`);
    console.error(`  ⚠️  ${metadata.name} CLI Not Installed`);
    console.error(`────────────────────────────────────────────────────────────`);
    console.error(`\nThe '${metadata.cliBinary}' command is not available.`);
    console.error(`Please install ${metadata.name} CLI first:\n`);
    console.error(`  ${metadata.installCommand}\n`);
    console.error(`────────────────────────────────────────────────────────────\n`);
    throw new Error(`${metadata.name} CLI is not installed.`);
  }

  // Run interactive login via Codex CLI with proper env.
  try {
    // Resolve codex command to handle Windows .cmd files
    const resolvedCodex = Bun.which('codex') ?? 'codex';

    const proc = Bun.spawn([resolvedCodex, 'login'], {
      env: { ...process.env, CODEX_HOME: codexHome },
      stdio: ['inherit', 'inherit', 'inherit'],
    });
    await proc.exited;
  } catch (error) {
    const err = error as unknown as { code?: string; stderr?: string; message?: string };
    const stderr = err?.stderr ?? '';
    const message = err?.message ?? '';
    const notFound =
      err?.code === 'ENOENT' ||
      /not recognized as an internal or external command/i.test(stderr || message) ||
      /command not found/i.test(stderr || message) ||
      /No such file or directory/i.test(stderr || message);

    if (notFound) {
      console.error(`\n────────────────────────────────────────────────────────────`);
      console.error(`  ⚠️  ${metadata.name} CLI Not Found`);
      console.error(`────────────────────────────────────────────────────────────`);
      console.error(`\n'${metadata.cliBinary} login' failed because the CLI is missing.`);
      console.error(`Please install ${metadata.name} CLI before trying again:\n`);
      console.error(`  ${metadata.installCommand}\n`);
      console.error(`────────────────────────────────────────────────────────────\n`);
      throw new Error(`${metadata.name} CLI is not installed.`);
    }

    throw error;
  }

  // Ensure the auth credential path exists; create a placeholder if still absent.
  try {
    await stat(authPath);
  } catch {
    await writeFile(authPath, '{}', 'utf8');
  }

  return true;
}

export async function clearAuth(): Promise<void> {
  const codexHome = await resolveCodexHome();
  const authPath = getAuthFilePath(codexHome);
  try {
    await rm(authPath, { force: true });
  } catch (_error) {
    // Ignore removal errors; treat as cleared
  }
}

export async function nextAuthMenuAction(): Promise<'login' | 'logout'> {
  return (await isAuthenticated()) ? 'logout' : 'login';
}
