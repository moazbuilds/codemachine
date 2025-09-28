import { createRequire } from 'module';
import { Command } from 'commander';
import { registerStartCommand } from './start.command.js';
import { registerTemplatesCommand } from './templates.command.js';
import { registerAuthCommands } from './auth.command.js';
import { registerAgentCommand } from './agent.command.js';
import { registerUiCommand } from './ui.command.js';
import { registerProjectManagerCommand } from './project-manager.command.js';
import { registerSessionCommand } from './session.command.js';

export function registerCli(program: Command): void {
  program
    .command('version')
    .description('Display CLI version')
    .action(() => {
      const require = createRequire(import.meta.url);
      const pkg = require('../../../package.json') as { version: string };
      console.log(`CodeMachine v${pkg.version}`);
    });

  program
    .command('mcp')
    .description('Model Context Protocol integration stubs')
    .action(() => {
      console.log('Model Context Protocol support coming soon');
    });

  registerStartCommand(program);
  registerUiCommand(program);
  registerTemplatesCommand(program);
  registerAuthCommands(program);
  registerAgentCommand(program);
  registerProjectManagerCommand(program);
  registerSessionCommand(program);
}
