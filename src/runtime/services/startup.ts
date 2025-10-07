import { rm, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

import { ensureAuth, isAuthenticated } from '../../infra/engines/codex/index.js';
import { renderMainMenu, renderTypewriter, renderLoginScreen } from '../../cli/presentation/index.js';

const legacyAuthPath = path.join(homedir(), 'codemachine', 'auth.json');

async function legacyAuthExists(): Promise<boolean> {
  try {
    await stat(legacyAuthPath);
    return true;
  } catch {
    return false;
  }
}

async function removeLegacyAuth(): Promise<void> {
  try {
    await rm(legacyAuthPath, { force: true });
  } catch {
    // Ignore cleanup errors; best-effort removal only.
  }
}

export interface StartupFlowResult {
  mainMenuDisplayed: boolean;
}

export async function runStartupFlow(): Promise<StartupFlowResult> {
  let mainMenuDisplayed = false;

  const [authenticated, legacyAuthPresent] = await Promise.all([
    isAuthenticated(),
    legacyAuthExists(),
  ]);

  const shouldLogin = !authenticated && !legacyAuthPresent;

  try {
    if (shouldLogin) {
      console.log(`${renderLoginScreen()}\n`);
      await ensureAuth();
      console.log('Authentication successful.\n');
    }

    const mainMenu = await renderMainMenu();
    await renderTypewriter({ text: `${mainMenu}\n` });
    mainMenuDisplayed = true;

    return { mainMenuDisplayed };
  } finally {
    await removeLegacyAuth();
  }
}
