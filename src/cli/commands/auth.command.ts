import type { Command } from 'commander';
import { codex } from '../../infra/engines/index.js';
import { selectFromMenu, type SelectionChoice } from '../presentation/selection-menu.js';
import * as claudeAuth from '../../infra/engines/claude/auth.js';

type AuthProvider = 'claude' | 'codex';

interface AuthProviderChoice extends SelectionChoice<AuthProvider> {
  title: string;
  value: AuthProvider;
  description?: string;
}

async function selectAuthProvider(): Promise<AuthProvider | undefined> {
  const choices: AuthProviderChoice[] = [
    {
      title: 'Claude',
      value: 'claude',
      description: 'Authenticate with Claude AI'
    },
    {
      title: 'Codex',
      value: 'codex',
      description: 'Authenticate with Codex AI'
    }
  ];

  return await selectFromMenu({
    message: 'Choose authentication provider:',
    choices,
    initial: 0
  });
}

async function handleLogin(provider: AuthProvider): Promise<void> {
  if (provider === 'claude') {
    const action = await claudeAuth.nextAuthMenuAction();
    if (action === 'logout') {
      console.log('Already authenticated with Claude. Use `codemachine auth logout` to sign out.');
      return;
    }
    await claudeAuth.ensureAuth();
    console.log('Claude authentication successful.');
  } else {
    const action = await codex.nextAuthMenuAction();
    if (action === 'logout') {
      console.log('Already authenticated with Codex. Use `codemachine auth logout` to sign out.');
      return;
    }
    await codex.ensureAuth();
    console.log('Codex authentication successful.');
  }
}

async function handleLogout(provider: AuthProvider): Promise<void> {
  if (provider === 'claude') {
    await claudeAuth.clearAuth();
    console.log('Signed out from Claude. Next action will be `login`.');
  } else {
    await codex.clearAuth();
    console.log('Signed out from Codex. Next action will be `login`.');
  }
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
