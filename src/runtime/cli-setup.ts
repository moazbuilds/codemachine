import { Command } from 'commander';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { registerCli } from '../cli/index.js';
import { runSessionShell } from '../cli/controllers/session-shell.js';
import { runStartupFlow } from './services/index.js';
import { registry } from '../infra/engines/index.js';
import { bootstrapWorkspace } from './services/workspace/index.js';
import { resolvePackageRoot } from '../shared/utils/package-json.js';

const DEFAULT_SPEC_PATH = '.codemachine/inputs/specifications.md';

// Resolve package root to find templates directory
const packageRoot = resolvePackageRoot(import.meta.url, 'runtime setup');

const templatesDir = path.resolve(packageRoot, 'templates', 'workflows');

export async function runCodemachineCli(argv: string[] = process.argv): Promise<void> {
  const program = new Command()
    .name('codemachine')
    .description('Codemachine multi-agent CLI orchestrator')
    .option('-d, --dir <path>', 'Target workspace directory', process.cwd())
    .option('--spec <path>', 'Path to the planning specification file', DEFAULT_SPEC_PATH)
    .action(async (options) => {
      // Default action: Run interactive session mode
      const cwd = process.env.CODEMACHINE_CWD || process.cwd();
      const specDisplayPath = options.spec ?? DEFAULT_SPEC_PATH;
      const specificationPath = path.resolve(cwd, specDisplayPath);

      const { mainMenuDisplayed } = await runStartupFlow(specDisplayPath);
      await runSessionShell({ cwd, specificationPath, specDisplayPath, showIntro: !mainMenuDisplayed });
    });

  program.hook('preAction', async () => {
    const { dir } =
      typeof program.optsWithGlobals === 'function' ? program.optsWithGlobals() : program.opts();
    const cwd = dir || process.cwd();
    process.env.CODEMACHINE_CWD = cwd;

    // Sync configurations for all engines that need it
    const engines = registry.getAll();
    for (const engine of engines) {
      if (engine.syncConfig) {
        await engine.syncConfig();
      }
    }

    // Only bootstrap if .codemachine folder doesn't exist
    const cmRoot = path.join(cwd, '.codemachine');
    if (!existsSync(cmRoot)) {
      // First run: create workspace with default template
      const defaultTemplate = path.join(templatesDir, 'codemachine.workflow.js');
      await bootstrapWorkspace({ cwd, templatePath: defaultTemplate });
    }
    // If .codemachine exists, skip bootstrap (don't regenerate or modify)
  });

  await registerCli(program);

  await program.parseAsync(argv);
}

const shouldRunCli = (() => {
  const entry = process.argv[1];
  if (!entry) return false;

  // For compiled binaries, Bun.main will be the binary itself
  if (typeof Bun !== 'undefined' && Bun.main) {
    try {
      const mainPath = fileURLToPath(Bun.main);
      const modulePath = fileURLToPath(import.meta.url);
      if (mainPath === modulePath) return true;
    } catch {
      // Continue to other checks
    }
  }

  try {
    const resolvedEntry = realpathSync(entry);
    const modulePath = realpathSync(fileURLToPath(import.meta.url));
    return resolvedEntry === modulePath;
  } catch {
    // Fallback: if entry contains 'index' or 'codemachine', run CLI
    return entry.includes('index') || entry.includes('codemachine');
  }
})();

if (shouldRunCli) {
  runCodemachineCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
