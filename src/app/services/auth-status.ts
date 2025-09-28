import { mkdir, stat, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { execa } from 'execa';

export async function resolveCodexHome(): Promise<string> {
  const targetHome = process.env.CODEX_HOME ?? path.join(homedir(), '.codemachine', 'codex');
  await mkdir(targetHome, { recursive: true });
  return targetHome;
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
  } catch (error) {
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
  } catch {}

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
  } catch (error) {
    // Ignore removal errors; treat as cleared
  }
}

export async function nextAuthMenuAction(): Promise<'login' | 'logout'> {
  return (await isAuthenticated()) ? 'logout' : 'login';
}
