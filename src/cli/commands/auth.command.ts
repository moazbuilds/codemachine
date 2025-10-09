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
    console.log(`Already authenticated with ${engine.metadata.name}. Use \`codemachine auth logout\` to sign out.`);
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
