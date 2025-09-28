import type { Command } from 'commander';
import { renderMainMenu } from '../presentation/main-menu.js';

export function registerUiCommand(program: Command): void {
  program
    .command('ui')
    .description('Show the Codemachine TUI home screen')
    .option('--typewriter', 'Animate output with a typewriter effect')
    .action(async (options: { typewriter?: boolean }) => {
      const text = await renderMainMenu();
      if (options.typewriter) {
        const { renderExecutionScreen } = await import('../presentation/execution-screen.js');
        await renderExecutionScreen(`${text}\n`);
      } else {
        console.log(text);
      }
    });
}

