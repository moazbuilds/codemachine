import { stat, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { execa } from 'execa';

import { expandHomeDir } from '../../../../shared/utils/index.js';
import { metadata } from './metadata.js';

const SENTINEL_FILE = 'auth.json';

function resolveOpenCodeConfigDir(customPath?: string): string {
  const configured = customPath ?? process.env.OPENCODE_CONFIG_DIR;
  const target = configured ? expandHomeDir(configured) : path.join(homedir(), '.codemachine', 'opencode');
  return target;
}

async function ensureConfigDirExists(configDir: string): Promise<void> {
  await mkdir(configDir, { recursive: true });
}

function getSentinelPath(configDir: string): string {
  return path.join(configDir, SENTINEL_FILE);
}

async function isCliInstalled(command: string): Promise<boolean> {
  try {
    const result = await execa(command, ['--version'], { timeout: 3000, reject: false });
    if (typeof result.exitCode === 'number' && result.exitCode === 0) {
      return true;
    }
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (/not recognized as an internal or external command/i.test(output)) return false;
    if (/command not found/i.test(output)) return false;
    if (/No such file or directory/i.test(output)) return false;
    return false;
  } catch {
    return false;
  }
}

function logInstallHelp(): void {
  console.error(`\n────────────────────────────────────────────────────────────`);
  console.error(`  ⚠️  ${metadata.name} CLI Not Installed`);
  console.error(`────────────────────────────────────────────────────────────`);
  console.error(`\nThe '${metadata.cliBinary}' command is not available. Install OpenCode via:\n`);
  console.error(`  npm i -g opencode-ai@latest`);
  console.error(`  brew install opencode`);
  console.error(`  scoop bucket add extras && scoop install extras/opencode`);
  console.error(`  choco install opencode`);
  console.error(`\nDocs: https://opencode.ai/docs`);
  console.error(`────────────────────────────────────────────────────────────\n`);
}

function logGuidance(configDir: string): void {
  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`  ✅  ${metadata.name} CLI Detected`);
  console.log(`────────────────────────────────────────────────────────────`);
  console.log(`\nOpenCode manages credentials via 'opencode auth'.`);
  console.log(`Run 'opencode auth list' to inspect providers or 'opencode auth login' to add one.`);
  console.log(`\nCodeMachine stores a sentinel at: ${getSentinelPath(configDir)}`);
  console.log(`Your actual API keys remain managed by OpenCode.`);
  console.log(`────────────────────────────────────────────────────────────\n`);
}

export async function isAuthenticated(): Promise<boolean> {
  return isCliInstalled(metadata.cliBinary);
}

function resolveOpenCodeDataDir(): string {
  const xdgData = process.env.XDG_DATA_HOME
    ? expandHomeDir(process.env.XDG_DATA_HOME)
    : path.join(homedir(), '.local', 'share');
  return path.join(xdgData, 'opencode');
}

async function hasOpenCodeCredential(providerId: string = 'opencode'): Promise<boolean> {
  const authPath = path.join(resolveOpenCodeDataDir(), 'auth.json');
  try {
    const raw = await readFile(authPath, 'utf8');
    const json = JSON.parse(raw);
    return !!json && typeof json === 'object' && providerId in json;
  } catch {
    return false;
  }
}

export async function ensureAuth(): Promise<boolean> {
  const configDir = resolveOpenCodeConfigDir();
  await ensureConfigDirExists(configDir);

  const cliInstalled = await isCliInstalled(metadata.cliBinary);
  if (!cliInstalled) {
    logInstallHelp();
    throw new Error(`${metadata.name} CLI is not installed.`);
  }

  const sentinelPath = getSentinelPath(configDir);
  await writeFile(
    sentinelPath,
    JSON.stringify({ verifiedAt: new Date().toISOString() }, null, 2),
    { encoding: 'utf8' },
  );

  logGuidance(configDir);
  return true;
}

export async function clearAuth(): Promise<void> {
  const configDir = resolveOpenCodeConfigDir();
  const sentinel = getSentinelPath(configDir);
  try {
    await rm(sentinel, { force: true });
  } catch {
    // Ignore removal errors
  }

  console.log(`\n${metadata.name} credentials are managed by the OpenCode CLI.`);
  console.log(`Removed CodeMachine sentinel at ${sentinel} (if it existed).\n`);
}

export async function nextAuthMenuAction(): Promise<'login' | 'logout'> {
  // If CLI is missing → login
  const cli = await isAuthenticated();
  if (!cli) return 'login';

  // If sentinel is missing or membership credential not found → show login guidance
  const configDir = resolveOpenCodeConfigDir();
  const sentinel = getSentinelPath(configDir);
  let hasSentinel = false;
  try {
    await stat(sentinel);
    hasSentinel = true;
  } catch {
    hasSentinel = false;
  }

  const hasMembership = await hasOpenCodeCredential('opencode');

  return hasSentinel && hasMembership ? 'logout' : 'login';
}

export { resolveOpenCodeConfigDir };
