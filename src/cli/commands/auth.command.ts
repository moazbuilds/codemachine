import type { Command } from 'commander';
import { registry } from '../../infra/engines/index.js';
import { selectFromMenu, type SelectionChoice } from '../presentation/selection-menu.js';

interface AuthProviderChoice extends SelectionChoice<string> {
  title: string;
  value: string;
  description?: string;
}

async function selectAuthProvider(): Promise<string | undefined> {
  const choices: AuthProviderChoice[] = registry.getAll().map(engine => ({
    title: engine.metadata.name,
    value: engine.metadata.id,
    description: engine.metadata.description
  }));

  return await selectFromMenu({
    message: 'Choose authentication provider:',
    choices,
    initial: 0
  });
}

async function handleLogin(providerId: string): Promise<void> {
  const engine = registry.get(providerId);
  if (!engine) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  const action = await engine.auth.nextAuthMenuAction();
  if (action === 'logout') {
    // Special handling for CCR - show configuration tip instead of generic message
    if (providerId === 'ccr') {
      console.log(`\n────────────────────────────────────────────────────────────`);
      console.log(`  ✅  ${engine.metadata.name} CLI Detected`);
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
    } else {
      console.log(`Already authenticated with ${engine.metadata.name}. Use \`codemachine auth logout\` to sign out.`);
    }
    return;
  }

  await engine.auth.ensureAuth();
  console.log(`${engine.metadata.name} authentication successful.`);
}

async function handleLogout(providerId: string): Promise<void> {
  const engine = registry.get(providerId);
  if (!engine) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  // Special handling for CCR - no logout needed
  if (providerId === 'ccr') {
    console.log(`\n────────────────────────────────────────────────────────────`);
    console.log(`  ℹ️  ${engine.metadata.name} Logout`);
    console.log(`────────────────────────────────────────────────────────────`);
    console.log(`\nCCR authentication is managed by the CCR CLI itself.`);
    console.log(`There is no logout action required in Codemachine.\n`);
    console.log(`To reconfigure CCR, simply run: ccr ui\n`);
    console.log(`────────────────────────────────────────────────────────────\n`);
    return;
  }

  await engine.auth.clearAuth();
  console.log(`Signed out from ${engine.metadata.name}. Next action will be \`login\`.`);
}

export function registerAuthCommands(program: Command): void {
  const authCommand = program
    .command('auth')
    .description('Authentication helpers');

  authCommand
    .command('login')
    .description('Authenticate with Codemachine services')
    .action(async () => {
      const provider = await selectAuthProvider();
      if (!provider) {
        console.log('No provider selected.');
        return;
      }
      await handleLogin(provider);
    });

  authCommand
    .command('logout')
    .description('Log out of Codemachine services')
    .action(async () => {
      const provider = await selectAuthProvider();
      if (!provider) {
        console.log('No provider selected.');
        return;
      }
      await handleLogout(provider);
    });
}
