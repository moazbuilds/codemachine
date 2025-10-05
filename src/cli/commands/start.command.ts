import * as path from 'node:path';
import type { Command } from 'commander';

import { runSessionShell } from './session.command.js';
import { runStartupFlow } from '../../app/services/startup-flow.js';

const DEFAULT_SPEC_PATH = '.codemachine/inputs/specifications.md';

type StartCommandOptions = {
  force?: boolean;
  spec?: string;
};

export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Start the Codemachine workflow (template-driven queue)')
    .option('--force', 'Overwrite existing planning outputs')
    .option('--spec <path>', 'Path to the planning specification file', DEFAULT_SPEC_PATH)
    .action(async (options: StartCommandOptions) => {
      const force = Boolean(options.force);
      const specificationPath = path.resolve(process.cwd(), options.spec ?? DEFAULT_SPEC_PATH);

      const cwd = process.env.CODEMACHINE_CWD || process.cwd();
      const { mainMenuDisplayed } = await runStartupFlow();

      await runSessionShell({ cwd, force, specificationPath, showIntro: !mainMenuDisplayed });
    });
}
