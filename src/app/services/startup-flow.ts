import { rm, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

import { ensureAuth, isAuthenticated } from './auth-status.js';
import { renderMainMenu } from '../../cli/presentation/main-menu.js';
import {
  renderLoginScreen,
  renderWelcomeScreen,
} from '../../cli/presentation/onboarding.js';

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
    console.log(`${mainMenu}\n`);
    mainMenuDisplayed = true;

    return { mainMenuDisplayed };
  } finally {
    await removeLegacyAuth();
  }
}
