import * as path from 'node:path';
import type { Command } from 'commander';

import { debug } from '../../shared/logging/logger.js';
import { clearTerminal } from '../../shared/utils/terminal.js';

const DEFAULT_SPEC_PATH = '.codemachine/inputs/specifications.md';

type StartCommandOptions = {
  spec?: string;
};

export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Run the workflow queue until completion (non-interactive)')
    .option('--spec <path>', 'Path to the planning specification file')
    .action(async (options: StartCommandOptions, command: Command) => {
      const cwd = process.env.CODEMACHINE_CWD || process.cwd();

      // Use command-specific --spec if provided, otherwise fall back to global --spec, then default
      const globalOpts = command.optsWithGlobals ? command.optsWithGlobals() : command.opts();
      const specPath = options.spec ?? globalOpts.spec ?? DEFAULT_SPEC_PATH;
      const specificationPath = path.resolve(cwd, specPath);

      debug(`Starting workflow (spec: ${specificationPath})`);

      // Comprehensive terminal clearing
      clearTerminal();

      // Determine execution method based on environment:
      // - Dev mode: Import and run workflow directly (no SolidJS preload in dev)
      // - Production: Spawn workflow binary (prevents JSX conflicts)
      const isDev = import.meta.url.includes('/src/')

      if (isDev) {
        // Development mode - directly import and run (SolidJS preload not active)
        const { runWorkflowQueue } = await import('../../workflows/index.js');
        try {
          await runWorkflowQueue({ cwd, specificationPath });
          console.log('\n✓ Workflow completed successfully');
          process.exit(0);
        } catch (error) {
          console.error('\n✗ Workflow failed:', error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      } else {
        // Production mode - spawn workflow binary to avoid JSX conflicts
        // The main binary has SolidJS transform, so we must use separate workflow binary
        const { spawnProcess } = await import('../../infra/process/spawn.js');

        try {
          const result = await spawnProcess({
            command: 'codemachine-workflow',
            args: [cwd, specificationPath],
            stdioMode: 'inherit', // Let workflow take full terminal control
          });

          if (result.exitCode === 0) {
            console.log('\n✓ Workflow completed successfully');
            process.exit(0);
          } else {
            console.error(`\n✗ Workflow failed with exit code ${result.exitCode}`);
            process.exit(result.exitCode);
          }
        } catch (error) {
          console.error('\n✗ Failed to spawn workflow:', error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }
    });
}
