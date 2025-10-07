import { stat, rm, writeFile, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { execa } from 'execa';

import { expandHomeDir } from '../../../shared/utils/index.js';

export interface ClaudeAuthOptions {
  profile?: string;
  claudeConfigDir?: string;
}

/**
 * Resolves the Claude config directory (shared for authentication)
 * Profile is only used for agent-specific data, not authentication
 */
export function resolveClaudeConfigDir(options?: ClaudeAuthOptions): string {
  if (options?.claudeConfigDir) {
    return expandHomeDir(options.claudeConfigDir);
  }

  if (process.env.CLAUDE_CONFIG_DIR) {
    return expandHomeDir(process.env.CLAUDE_CONFIG_DIR);
  }

  // Authentication is shared across all profiles
  return path.join(homedir(), '.codemachine', 'claude');
}

/**
 * Gets the path to the credentials file
 * Claude stores it directly in CLAUDE_CONFIG_DIR
 */
export function getCredentialsPath(configDir: string): string {
  return path.join(configDir, '.credentials.json');
}

/**
 * Gets paths to all Claude-related files that need to be cleaned up
 */
export function getClaudeAuthPaths(configDir: string): string[] {
  return [
    getCredentialsPath(configDir), // .credentials.json
    path.join(configDir, '.claude.json'),
    path.join(configDir, '.claude.json.backup'),
  ];
}

/**
 * Checks if Claude is authenticated for the given profile
 */
export async function isAuthenticated(options?: ClaudeAuthOptions): Promise<boolean> {
  const configDir = resolveClaudeConfigDir(options);
  const credPath = getCredentialsPath(configDir);

  try {
    await stat(credPath);
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Ensures Claude is authenticated, running setup-token if needed
 */
export async function ensureAuth(options?: ClaudeAuthOptions): Promise<boolean> {
  const configDir = resolveClaudeConfigDir(options);
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
    const claudeDir = path.dirname(credPath);
    await mkdir(claudeDir, { recursive: true });
    await writeFile(credPath, '{}', { encoding: 'utf8' });
    return true;
  }

  // Run interactive setup-token via Claude CLI with proper env
  await execa('claude', ['setup-token'], {
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
    stdio: 'inherit',
  });

  // Verify the credentials were created
  try {
    await stat(credPath);
  } catch {
    throw new Error('Claude setup-token failed to create credentials');
  }

  return true;
}

/**
 * Clears all Claude authentication data for the given profile
 */
export async function clearAuth(options?: ClaudeAuthOptions): Promise<void> {
  const configDir = resolveClaudeConfigDir(options);
  const authPaths = getClaudeAuthPaths(configDir);

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
export async function nextAuthMenuAction(options?: ClaudeAuthOptions): Promise<'login' | 'logout'> {
  return (await isAuthenticated(options)) ? 'logout' : 'login';
}
