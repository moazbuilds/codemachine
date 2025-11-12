import { createRequire } from 'module';
import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  registerStartCommand,
  registerTemplatesCommand,
  registerAuthCommands,
  registerRunCommand,
  registerStepCommand,
  registerAgentsCommand,
} from './commands/index.js';

export async function registerCli(program: Command): Promise<void> {
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
  registerTemplatesCommand(program);
  registerAuthCommands(program);
  registerAgentsCommand(program);
  await registerRunCommand(program);
  await registerStepCommand(program);
}

function findPackageJson(moduleUrl: string): string {
  // For compiled binaries, try to find package.json from current working directory
  if (typeof Bun !== 'undefined' && Bun.main && Bun.main.startsWith('/$bunfs/')) {
    const cwdPackageJson = join(process.cwd(), 'package.json');
    if (existsSync(cwdPackageJson)) return cwdPackageJson;

    // Fallback: embed version info directly for compiled binaries
    // This is a temporary workaround - ideally version would be embedded during build
    return join(process.cwd(), 'package.json'); // Let it fail gracefully if not found
  }

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
