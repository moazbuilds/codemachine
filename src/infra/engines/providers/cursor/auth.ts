import { stat, rm, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { execa } from 'execa';

import { expandHomeDir } from '../../../../shared/utils/index.js';
import { metadata } from './metadata.js';

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

export interface CursorAuthOptions {
  profile?: string;
  cursorConfigDir?: string;
}

/**
 * Resolves the Cursor config directory (shared for authentication)
 * Profile is only used for agent-specific data, not authentication
 */
export function resolveCursorConfigDir(options?: CursorAuthOptions): string {
  if (options?.cursorConfigDir) {
    return expandHomeDir(options.cursorConfigDir);
  }

  if (process.env.CURSOR_CONFIG_DIR) {
    return expandHomeDir(process.env.CURSOR_CONFIG_DIR);
  }

  // Authentication is shared across all profiles
  return path.join(homedir(), '.codemachine', 'cursor');
}

/**
 * Gets the path to the .cursor folder
 * Cursor stores authentication data in .cursor folder
 */
export function getCursorAuthPath(configDir: string): string {
  return path.join(configDir, '.cursor');
}

/**
 * Gets paths to all Cursor-related files that need to be cleaned up
 */
export function getCursorAuthPaths(configDir: string): string[] {
  return [
    getCursorAuthPath(configDir), // .cursor folder
  ];
}

/**
 * Checks if Cursor is authenticated for the given profile
 */
export async function isAuthenticated(options?: CursorAuthOptions): Promise<boolean> {
  const configDir = resolveCursorConfigDir(options);
  const authPath = getCursorAuthPath(configDir);

  try {
    const stats = await stat(authPath);
    // Check if .cursor exists and is a directory
    return stats.isDirectory();
  } catch (_error) {
    return false;
  }
}

/**
 * Ensures Cursor is authenticated, running login if needed
 */
export async function ensureAuth(options?: CursorAuthOptions): Promise<boolean> {
  const configDir = resolveCursorConfigDir(options);
  const authPath = getCursorAuthPath(configDir);

  // If already authenticated, nothing to do
  try {
    const stats = await stat(authPath);
    if (stats.isDirectory()) {
      return true;
    }
  } catch {
    // Auth folder doesn't exist
  }

  if (process.env.CODEMACHINE_SKIP_AUTH === '1') {
    // Create a placeholder for testing/dry-run mode
    await mkdir(authPath, { recursive: true });
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

  // Run interactive login via Cursor CLI with proper env
  console.log(`\nRunning Cursor authentication...\n`);
  console.log(`Config directory: ${configDir}\n`);

  await execa('cursor-agent', ['login'], {
    env: { ...process.env },
    cwd: configDir,
    stdio: 'inherit',
  });

  // Verify the auth folder was created
  try {
    const stats = await stat(authPath);
    if (stats.isDirectory()) {
      return true;
    }
  } catch {
    // Auth folder wasn't created
    console.error(`\n────────────────────────────────────────────────────────────`);
    console.error(`  ℹ️  Cursor CLI Authentication Notice`);
    console.error(`────────────────────────────────────────────────────────────`);
    console.error(`\nCursor authentication was not completed successfully.`);
    console.error(`Please try running 'cursor-agent login' manually.\n`);
    console.error(`────────────────────────────────────────────────────────────\n`);

    throw new Error('Authentication incomplete. Please run cursor-agent login manually.');
  }

  return true;
}

/**
 * Clears all Cursor authentication data for the given profile
 */
export async function clearAuth(options?: CursorAuthOptions): Promise<void> {
  const configDir = resolveCursorConfigDir(options);
  const authPaths = getCursorAuthPaths(configDir);

  // Remove all auth-related files/folders
  await Promise.all(
    authPaths.map(async (authPath) => {
      try {
        await rm(authPath, { force: true, recursive: true });
      } catch (_error) {
        // Ignore removal errors; treat as cleared
      }
    }),
  );
}

/**
 * Returns the next auth menu action based on current auth state
 */
export async function nextAuthMenuAction(options?: CursorAuthOptions): Promise<'login' | 'logout'> {
  return (await isAuthenticated(options)) ? 'logout' : 'login';
}
