import type { Command } from 'commander';
import { clearAuth, ensureAuth, nextAuthMenuAction } from '../../app/services/auth-status.js';

export function registerAuthCommands(program: Command): void {
  const authCommand = program
    .command('auth')
    .description('Authentication helpers');

  authCommand
    .command('login')
    .description('Authenticate with Codemachine services')
    .action(async () => {
      const action = await nextAuthMenuAction();
      if (action === 'logout') {
        console.log('Already authenticated. Use `codemachine auth logout` to sign out.');
        return;
      }
      await ensureAuth();
      console.log('Authentication successful.');
    });

  authCommand
    .command('logout')
    .description('Log out of Codemachine services')
    .action(async () => {
      await clearAuth();
      console.log('Signed out. Next action will be `login`.');
    });
}
