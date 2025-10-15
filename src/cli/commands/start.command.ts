import * as path from 'node:path';
import type { Command } from 'commander';

import { runWorkflowQueue } from '../../workflows/index.js';

const DEFAULT_SPEC_PATH = '.codemachine/inputs/specifications.md';

type StartCommandOptions = {
  spec?: string;
};

export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Run the workflow queue until completion (non-interactive)')
    .option('--spec <path>', 'Path to the planning specification file', DEFAULT_SPEC_PATH)
    .action(async (options: StartCommandOptions) => {
      const specificationPath = path.resolve(process.cwd(), options.spec ?? DEFAULT_SPEC_PATH);
      const cwd = process.env.CODEMACHINE_CWD || process.cwd();

      console.log(`Starting workflow (spec: ${specificationPath})`);

      try {
        await runWorkflowQueue({ cwd, specificationPath });
        console.log('\n✓ Workflow completed successfully');
        process.exit(0);
      } catch (error) {
        console.error('\n✗ Workflow failed:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
