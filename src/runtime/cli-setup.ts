// IMMEDIATE SPLASH - Only show for main TUI (no subcommands)
// Show splash if: no arguments OR only options (starting with -)
const hasSubcommand = process.argv.length > 2 && !process.argv[2].startsWith('-');
if (process.stdout.isTTY && !hasSubcommand) {
  const { rows = 24, columns = 80 } = process.stdout;
  const centerY = Math.floor(rows / 2);
  const centerX = Math.floor(columns / 2);
  process.stdout.write('\x1b[2J\x1b[H\x1b[?25l'); // Clear, home, hide cursor
  process.stdout.write(`\x1b[${centerY};${centerX - 6}H`);
  process.stdout.write('\x1b[38;2;224;230;240mCode\x1b[1mMachine\x1b[0m');
  process.stdout.write(`\x1b[${centerY + 1};${centerX - 6}H`);
  process.stdout.write('\x1b[38;2;0;217;255m━━━━━━━━━━━━\x1b[0m');
}

import { Command } from 'commander';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const DEFAULT_SPEC_PATH = '.codemachine/inputs/specifications.md';

/**
 * Background initialization - runs AFTER TUI is visible
 * Loads heavy modules and performs I/O operations while user reads UI
 */
async function initializeInBackground(cwd: string): Promise<void> {
  const cmRoot = path.join(cwd, '.codemachine');

  // Only bootstrap if .codemachine doesn't exist
  if (!existsSync(cmRoot)) {
    // Lazy load bootstrap utilities (only on first run)
    const { bootstrapWorkspace } = await import('./services/workspace/index.js');
    const { resolvePackageRoot } = await import('../shared/utils/package-json.js');

    const packageRoot = resolvePackageRoot(import.meta.url, 'runtime setup');
    const templatesDir = path.resolve(packageRoot, 'templates', 'workflows');
    const defaultTemplate = path.join(templatesDir, 'codemachine.workflow.js');

    await bootstrapWorkspace({ cwd, templatePath: defaultTemplate });
  }

  // Lazy load and initialize engine registry
  const { registry } = await import('../infra/engines/index.js');
  const engines = registry.getAll();

  // Sync engine configs in background
  for (const engine of engines) {
    if (engine.syncConfig) {
      await engine.syncConfig();
    }
  }
}

export async function runCodemachineCli(argv: string[] = process.argv): Promise<void> {
  const program = new Command()
    .name('codemachine')
    .description('Codemachine multi-agent CLI orchestrator')
    .option('-d, --dir <path>', 'Target workspace directory', process.cwd())
    .option('--spec <path>', 'Path to the planning specification file', DEFAULT_SPEC_PATH)
    .action(async (options) => {
      // Set CWD immediately (lightweight, no I/O)
      const cwd = options.dir || process.cwd();
      process.env.CODEMACHINE_CWD = cwd;

      // Start background initialization (non-blocking, fire-and-forget)
      // This runs while TUI is visible and user is reading/thinking
      initializeInBackground(cwd).catch(err => {
        console.error('[Background Init Error]', err);
      });

      // Launch TUI immediately - don't wait for background init
      // Import via launcher to scope SolidJS transform to TUI only
      const { startTUI } = await import('../cli/tui/launcher.js');
      await startTUI();
    });

  // Lazy load CLI commands only if user uses subcommands
  if (argv.length > 2 && !argv[2].startsWith('-')) {
    const { registerCli } = await import('../cli/index.js');
    await registerCli(program);
  }

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
