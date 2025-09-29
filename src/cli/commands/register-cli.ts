import { createRequire } from 'module';
import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerStartCommand } from './start.command.js';
import { registerTemplatesCommand } from './templates.command.js';
import { registerAuthCommands } from './auth.command.js';
import { registerAgentCommand } from './agent.command.js';
import { registerUiCommand } from './ui.command.js';
import { registerSessionCommand } from './session.command.js';

export function registerCli(program: Command): void {
  const packageJsonPath = findPackageJson(import.meta.url);
  program
    .command('version')
    .description('Display CLI version')
    .action(() => {
      const require = createRequire(import.meta.url);
      const pkg = require(packageJsonPath) as { version: string };
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
  registerSessionCommand(program);
}

function findPackageJson(moduleUrl: string): string {
  let currentDir = dirname(fileURLToPath(moduleUrl));
  const { root } = parse(currentDir);

  while (true) {
    const candidate = join(currentDir, 'package.json');
    if (existsSync(candidate)) return candidate;
    if (currentDir === root) break;
    currentDir = dirname(currentDir);
  }

  throw new Error('Unable to locate package.json from CLI module');
}
