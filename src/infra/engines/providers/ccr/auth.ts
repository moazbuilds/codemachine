import { stat, rm, writeFile, mkdir } from 'node:fs/promises';
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
    const result = await execa(command, ['--version'], { timeout: 3000, reject: false });
    if (typeof result.exitCode === 'number' && result.exitCode === 0) return true;
    const out = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (/not recognized as an internal or external command/i.test(out)) return false;
    if (/command not found/i.test(out)) return false;
    if (/No such file or directory/i.test(out)) return false;
    return false;
  } catch {
    return false;
  }
}

export interface CcrAuthOptions {
  ccrConfigDir?: string;
}

/**
 * Resolves the CCR config directory (shared for authentication)
 */
export function resolveCcrConfigDir(options?: CcrAuthOptions): string {
  if (options?.ccrConfigDir) {
    return expandHomeDir(options.ccrConfigDir);
  }

  if (process.env.CCR_CONFIG_DIR) {
    return expandHomeDir(process.env.CCR_CONFIG_DIR);
  }

  // Authentication is shared globally
  return path.join(homedir(), '.codemachine', 'ccr');
}

/**
 * Gets the path to the credentials file
 * CCR stores it directly in CCR_CONFIG_DIR
 */
export function getCredentialsPath(configDir: string): string {
  return path.join(configDir, '.credentials.json');
}

/**
 * Gets paths to all CCR-related files that need to be cleaned up
 */
export function getCcrAuthPaths(configDir: string): string[] {
  return [
    getCredentialsPath(configDir), // .credentials.json
    path.join(configDir, '.ccr.json'),
    path.join(configDir, '.ccr.json.backup'),
  ];
}

/**
 * Checks if CCR is authenticated
 */
export async function isAuthenticated(options?: CcrAuthOptions): Promise<boolean> {
  // Check if token is set via environment variable
  if (process.env.CCR_CODE_TOKEN) {
    return true;
  }

  const configDir = resolveCcrConfigDir(options);
  const credPath = getCredentialsPath(configDir);

  try {
    await stat(credPath);
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Ensures CCR is authenticated
 * Unlike Claude, CCR doesn't require interactive setup - authentication is done via environment variable
 */
export async function ensureAuth(options?: CcrAuthOptions): Promise<boolean> {
  // Check if token is already set via environment variable
  if (process.env.CCR_CODE_TOKEN) {
    return true;
  }

  const configDir = resolveCcrConfigDir(options);
  const credPath = getCredentialsPath(configDir);

  // If already authenticated, nothing to do
  try {
    await stat(credPath);
    return true;
  } catch {
    // Credentials file doesn't exist
  }

  if (process.env.CODEMACHINE_SKIP_AUTH === '1') {
    // Create a placeholder for testing/dry-run mode
    const ccrDir = path.dirname(credPath);
    await mkdir(ccrDir, { recursive: true });
    await writeFile(credPath, '{}', { encoding: 'utf8' });
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

  // For CCR, authentication is token-based via environment variable
  console.error(`\n────────────────────────────────────────────────────────────`);
  console.error(`  ℹ️  CCR Authentication Notice`);
  console.error(`────────────────────────────────────────────────────────────`);
  console.error(`\nCCR uses token-based authentication.`);
  console.error(`Please set your CCR token as an environment variable:\n`);
  console.error(`  export CCR_CODE_TOKEN=<your-token>\n`);
  console.error(`For persistence, add this line to your shell configuration:`);
  console.error(`  ~/.bashrc (Bash) or ~/.zshrc (Zsh)\n`);
  console.error(`────────────────────────────────────────────────────────────\n`);

  throw new Error('Authentication incomplete. Please set CCR_CODE_TOKEN environment variable.');
}

/**
 * Clears all CCR authentication data
 */
export async function clearAuth(options?: CcrAuthOptions): Promise<void> {
  const configDir = resolveCcrConfigDir(options);
  const authPaths = getCcrAuthPaths(configDir);

  // Remove all auth-related files
  await Promise.all(
    authPaths.map(async (authPath) => {
      try {
        await rm(authPath, { force: true });
      } catch (_error) {
        // Ignore removal errors; treat as cleared
      }
    }),
  );
}

/**
 * Returns the next auth menu action based on current auth state
 */
export async function nextAuthMenuAction(options?: CcrAuthOptions): Promise<'login' | 'logout'> {
  return (await isAuthenticated(options)) ? 'logout' : 'login';
}