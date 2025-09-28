import * as path from 'node:path';
import type { Command } from 'commander';
import { runPlanningWorkflow } from '../../core/workflows/planning-workflow.js';
import { runAgentsBuilder } from '../../agents/runtime/agents-builder.js';

const DEFAULT_SPEC_PATH = 'runner-prompts/user-input.md';

type StartCommandOptions = {
  force?: boolean;
  spec?: string;
};

export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Start the Codemachine planning workflow')
    .option('--force', 'Overwrite existing planning outputs')
    .option('--spec <path>', 'Path to the planning specification file', DEFAULT_SPEC_PATH)
    .action(async (options: StartCommandOptions) => {
      const force = Boolean(options.force);
      const specificationPath = path.resolve(process.cwd(), options.spec ?? DEFAULT_SPEC_PATH);

      console.log(`Launching planning workflow (spec=${specificationPath}, force=${force})`);
      // Seed project-specific agents and plan before entering planning workflow
      await runAgentsBuilder({
        workingDir: process.env.CODEMACHINE_CWD || process.cwd(),
        force,
        specPath: specificationPath,
      });
      await runPlanningWorkflow({ force, specificationPath });
    });
}
