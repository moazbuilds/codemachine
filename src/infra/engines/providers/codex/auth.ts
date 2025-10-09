import { stat, rm, writeFile, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { execa } from 'execa';

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
    await execa(command, ['--version'], { timeout: 3000, reject: false });
    return true;
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
  await execa('codex', ['login'], {
    env: { ...process.env, CODEX_HOME: codexHome },
    stdio: 'inherit',
  });

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
