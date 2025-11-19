import { stat, rm, writeFile, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

import { expandHomeDir } from '../../../../shared/utils/index.js';
import { metadata } from './metadata.js';

/**
 * Check if CLI is installed
 */
async function isCliInstalled(command: string): Promise<boolean> {
  try {
    // Resolve command using Bun.which() to handle Windows .cmd files
    const resolvedCommand = Bun.which(command) ?? command;

    // Try -v first (CCR uses -v instead of --version)
    const proc = Bun.spawn([resolvedCommand, '-v'], {
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

    // Check for error messages indicating command not found
    if (/not recognized as an internal or external command/i.test(out)) return false;
    if (/command not found/i.test(out)) return false;
    if (/No such file or directory/i.test(out)) return false;

    // If exit code is 0, CLI is installed
    if (typeof exitCode === 'number' && exitCode === 0) return true;

    // For CCR, check if output contains version info (even with non-zero exit code)
    if (/version:\s*\d+\.\d+\.\d+/i.test(out)) return true;

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
 * Gets the path to the .enable file
 * This simple marker file indicates CCR is enabled in codemachine
 */
export function getCredentialsPath(configDir: string): string {
  return path.join(configDir, '.enable');
}

/**
 * Gets paths to all CCR-related files that need to be cleaned up
 */
export function getCcrAuthPaths(configDir: string): string[] {
  return [
    getCredentialsPath(configDir), // .enable
  ];
}

/**
 * Checks if CCR is authenticated
 * For CCR, we check if the .enable file exists
 */
export async function isAuthenticated(options?: CcrAuthOptions): Promise<boolean> {
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
 * Creates the .enable file to mark CCR as enabled in codemachine
 */
export async function ensureAuth(options?: CcrAuthOptions): Promise<boolean> {
  const configDir = resolveCcrConfigDir(options);
  const credPath = getCredentialsPath(configDir);

  // If already authenticated, nothing to do
  try {
    await stat(credPath);
    return true;
  } catch {
    // Credentials file doesn't exist
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

  // Create the .enable marker file
  const ccrDir = path.dirname(credPath);
  await mkdir(ccrDir, { recursive: true });
  await writeFile(credPath, '', { encoding: 'utf8' });

  // Show configuration tip
  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`  ✅  ${metadata.name} CLI Detected`);
  console.log(`────────────────────────────────────────────────────────────`);
  console.log(`\n💡 Tip: CCR is installed but you might still need to configure it`);
  console.log(`       (if you haven't already).\n`);
  console.log(`To configure CCR:`);
  console.log(`  1. Run: ccr ui`);
  console.log(`     Opens the web UI to add your providers\n`);
  console.log(`  2. Or manually edit: ~/.claude-code-router/config.json\n`);
  console.log(`🚀 Easiest way to use CCR inside Codemachine:`);
  console.log(`   Logout from all other engines using:`);
  console.log(`     codemachine auth logout`);
  console.log(`   This will run CCR by default for all engines.\n`);
  console.log(`   Or modify the template by adding ccr engine.`);
  console.log(`   For full guide, check:`);
  console.log(`   https://github.com/moazbuilds/CodeMachine-CLI/blob/main/docs/customizing-workflows.md\n`);
  console.log(`For more help, visit:`);
  console.log(`  https://github.com/musistudio/claude-code-router\n`);
  console.log(`────────────────────────────────────────────────────────────\n`);

  return true;
}

/**
 * Clears all CCR authentication data
 * Removes the .enable file to disable CCR usage in codemachine
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