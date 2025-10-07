import { rm, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

import { ensureAuth as ensureCodexAuth, isAuthenticated as isCodexAuthenticated } from '../../infra/engines/codex/index.js';
import { ensureAuth as ensureClaudeAuth, isAuthenticated as isClaudeAuthenticated } from '../../infra/engines/claude/auth.js';
import { renderMainMenu, renderTypewriter, renderLoginScreen } from '../../cli/presentation/index.js';
import { selectFromMenu } from '../../cli/presentation/selection-menu.js';

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

  const [codexAuthenticated, claudeAuthenticated, legacyAuthPresent] = await Promise.all([
    isCodexAuthenticated(),
    isClaudeAuthenticated(),
    legacyAuthExists(),
  ]);

  const shouldLogin = !codexAuthenticated && !claudeAuthenticated && !legacyAuthPresent;

  try {
    if (shouldLogin) {
      console.log(`${renderLoginScreen()}\n`);

      const provider = await selectFromMenu({
        message: 'Choose authentication provider:',
        choices: [
          { title: 'Codex', value: 'codex' as const, description: 'Authenticate with Codex AI' },
          { title: 'Claude', value: 'claude' as const, description: 'Authenticate with Claude AI (experimental)' }
        ],
        initial: 0
      });

      if (provider === 'claude') {
        await ensureClaudeAuth();
      } else if (provider === 'codex') {
        await ensureCodexAuth();
      } else {
        throw new Error('No authentication provider selected');
      }

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
