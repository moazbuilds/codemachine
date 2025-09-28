import type { Command } from 'commander';

export function registerTemplatesCommand(program: Command): void {
  program
    .command('templates')
    .description('Manage Codemachine templates (coming soon)')
    .action(() => {
      console.log('Templates command scaffolding not implemented yet.');
    });
}
