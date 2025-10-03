#!/usr/bin/env node
import { Command } from 'commander';
import { realpathSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { registerCli } from '../cli/commands/register-cli.js';
import { syncCodexConfig } from './services/config-sync.js';
import { bootstrapWorkspace } from './services/workspace-bootstrap.js';
import { resolveTemplateFromSettings } from '../core/workflows/manager/template-loader.js';

export async function runCodemachineCli(argv: string[] = process.argv): Promise<void> {
  const program = new Command()
    .name('codemachine')
    .description('Codemachine multi-agent CLI orchestrator')
    .option('-d, --dir <path>', 'Target workspace directory', process.cwd());

  program.hook('preAction', async () => {
    const { dir } =
      typeof program.optsWithGlobals === 'function' ? program.optsWithGlobals() : program.opts();
    const cwd = dir || process.cwd();
    process.env.CODEMACHINE_CWD = cwd;

    await syncCodexConfig();

    // Only bootstrap if .codemachine folder doesn't exist
    const cmRoot = path.join(cwd, '.codemachine');
    if (!existsSync(cmRoot)) {
      // First run: create workspace with template from settings.js
      const templatePath = resolveTemplateFromSettings();
      await bootstrapWorkspace({ cwd, templatePath });
    }
    // If .codemachine exists, skip bootstrap (don't regenerate or modify)
  });

  registerCli(program);

  const [nodePath = process.execPath, scriptPath = fileURLToPath(import.meta.url)] = argv;
  const baseArgv = [nodePath, scriptPath];
  const effectiveArgv = argv.length > 2 ? argv : [...baseArgv, 'start'];
  await program.parseAsync(effectiveArgv);
}

const shouldRunCli = (() => {
  const entry = process.argv[1];
  if (!entry) return false;

  try {
    const resolvedEntry = realpathSync(entry);
    const modulePath = realpathSync(fileURLToPath(import.meta.url));
    return resolvedEntry === modulePath;
  } catch {
    return entry.includes('index');
  }
})();

if (shouldRunCli) {
  // Entrypoint when invoked directly (node dist/index.js) or via linked binary.
  runCodemachineCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
