import type { Command } from 'commander';
import { OrchestrationService } from '../../agents/orchestration/index.js';
import chalk from 'chalk';

/**
 * Register the orchestrate command
 */
export function registerOrchestrateCommand(program: Command): void {
  program
    .command('orchestrate <script>')
    .description('Orchestrate multiple agents with parallel (&) and sequential (&&) execution')
    .option('-d, --dir <directory>', 'Working directory', process.cwd())
    .action(async (script: string, options: { dir: string }) => {
      try {
        const orchestrator = OrchestrationService.getInstance();

        await orchestrator.execute(script, {
          workingDir: options.dir
        });

        process.exit(0);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`\nOrchestration failed: ${message}\n`));
        process.exit(1);
      }
    });
}

/**
 * Example usage:
 *
 * Parallel execution:
 * codemachine orchestrate "frontend 'Build UI components' & backend 'Build API endpoints' & db 'Setup schema'"
 *
 * Sequential execution:
 * codemachine orchestrate "db 'Setup schema' && backend 'Create models' && api 'Build endpoints'"
 *
 * Mixed execution:
 * codemachine orchestrate "db 'Setup' && frontend 'UI' & backend 'API' && test 'E2E tests'"
 */
