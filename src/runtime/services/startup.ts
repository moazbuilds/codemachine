import { rm, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

import { registry } from '../../infra/engines/index.js';
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

  // Check authentication status for all registered engines
  const authChecks = await Promise.all(
    registry.getAll().map(async (engine) => ({
      id: engine.metadata.id,
      authenticated: await engine.auth.isAuthenticated(),
    }))
  );

  const legacyAuthPresent = await legacyAuthExists();
  const hasAnyAuth = authChecks.some((check) => check.authenticated);
  const shouldLogin = !hasAnyAuth && !legacyAuthPresent;

  try {
    if (shouldLogin) {
      console.log(`${renderLoginScreen()}\n`);

      const choices = registry.getAll().map((engine) => ({
        title: engine.metadata.name,
        value: engine.metadata.id,
        description: engine.metadata.description + (engine.metadata.experimental ? ' (experimental)' : ''),
      }));

      if (choices.length === 0) {
        console.error('\n⚠️  No engines available. Please check your installation.\n');
        process.exit(1);
      }

      let providerId: string | undefined;
      try {
        providerId = await selectFromMenu({
          message: 'Choose authentication provider:',
          choices,
          initial: 0,
        });
      } catch (_error) {
        console.error('\n⚠️  Authentication selection failed.');
        console.error('You can authenticate manually by running: codemachine auth login\n');
        console.error('Continuing without authentication...\n');
        // Continue without auth - some commands may still work
        providerId = undefined;
      }

      if (providerId) {
        const engine = registry.get(providerId);
        if (!engine) {
          console.error(`\n⚠️  Unknown provider: ${providerId}`);
          console.error('You can authenticate manually by running: codemachine auth login\n');
        } else {
          try {
            await engine.auth.ensureAuth();
            console.log('✅ Authentication successful.\n');
          } catch (error) {
            console.error('\n⚠️  Authentication failed:', error instanceof Error ? error.message : String(error));
            console.error('\nPlease try again or authenticate manually by running:');
            console.error(`  codemachine auth login\n`);
            console.error('Exiting...\n');
            process.exit(1);
          }
        }
      } else if (shouldLogin) {
        // User canceled or selector failed
        console.log('\n⚠️  No authentication provider selected.');
        console.log('You can authenticate later by running: codemachine auth login\n');
        console.log('Note: Some commands require authentication to work.\n');
      }
    }

    const mainMenu = await renderMainMenu();
    await renderTypewriter({ text: `${mainMenu}\n` });
    mainMenuDisplayed = true;

    return { mainMenuDisplayed };
  } finally {
    await removeLegacyAuth();
  }
}
