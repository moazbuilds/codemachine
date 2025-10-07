import { Command } from 'commander';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { registerCli } from '../cli/index.js';
import { codex } from '../infra/engines/index.js';
import { bootstrapWorkspace } from './services/workspace/index.js';

// Resolve package root to find templates directory
const packageRoot = (() => {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  let current = moduleDir;
  while (true) {
    if (existsSync(path.join(current, 'package.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return moduleDir;
    current = parent;
  }
})();

const templatesDir = path.resolve(packageRoot, 'templates', 'workflows');

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

    await codex.syncCodexConfig();

    // Only bootstrap if .codemachine folder doesn't exist
    const cmRoot = path.join(cwd, '.codemachine');
    if (!existsSync(cmRoot)) {
      // First run: create workspace with default template
      const defaultTemplate = path.join(templatesDir, 'codemachine.workflow.js');
      await bootstrapWorkspace({ cwd, templatePath: defaultTemplate });
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
  runCodemachineCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
