import type { Command } from 'commander';
import { CoordinatorService } from '../../agents/coordinator/index.js';
import { MonitoringCleanup } from '../../agents/monitoring/index.js';
import chalk from 'chalk';

type RunCommandOptions = {
  model?: string;
  dir: string;
};

/**
 * Register the unified run command (replaces agent + orchestrate)
 */
export async function registerRunCommand(program: Command): Promise<void> {
  // Import registry to get default engine name
  const { registry } = await import('../../infra/engines/index.js');
  const defaultEngine = registry.getDefault();
  const defaultEngineName = defaultEngine?.metadata.name ?? 'default engine';

  program
    .command('run <script>')
    .description(`Run agent(s) with enhanced syntax using ${defaultEngineName}`)
    .option('--model <model>', 'Model to use (overrides agent config)')
    .option('-d, --dir <directory>', 'Working directory', process.cwd())
    .action(async (script: string, options: RunCommandOptions) => {
      // Set up cleanup handlers for graceful shutdown
      MonitoringCleanup.setup();

      try {
        await runScript(script, options);
        process.exit(0);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`\nExecution failed: ${message}\n`));
        process.exit(1);
      }
    });

  // Register engine-specific variants (await to ensure they're registered)
  await registerEngineRunCommands(program);
}

/**
 * Main script execution logic
 * Uses CoordinatorService for both single agents and coordination
 */
async function runScript(script: string, options: RunCommandOptions): Promise<void> {
  const trimmed = script.trim();

  // CoordinatorService handles both single agents and coordination
  // No need for separate detection - the parser handles both syntaxes
  const coordinator = CoordinatorService.getInstance();
  await coordinator.execute(trimmed, {
    workingDir: options.dir
  });
}

/**
 * Register engine-specific run commands
 */
async function registerEngineRunCommands(program: Command): Promise<void> {
  // Import registry dynamically to avoid circular dependencies
  const { registry } = await import('../../infra/engines/index.js');

  // Register a subcommand for each engine in the registry
  for (const engine of registry.getAll()) {
    const engineCommand = program
      .command(engine.metadata.cliCommand)
      .description(`Use ${engine.metadata.name} engine for agent execution`);

    engineCommand
      .command('run')
      .description(`Run agent(s) with ${engine.metadata.name}`)
      .argument('<script>', 'Agent script to execute')
      .option('--model <model>', 'Model to use (overrides agent config)')
      .option('-d, --dir <directory>', 'Working directory', process.cwd())
      .action(async (script: string, options: RunCommandOptions) => {
        // Set up cleanup handlers for graceful shutdown
        MonitoringCleanup.setup();

        try {
          // For engine-specific run, we need to pass the engine parameter
          // This is a simplified version - full implementation would need engine parameter support
          await runScript(script, options);
          process.exit(0);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(chalk.red(`\nExecution failed: ${message}\n`));
          process.exit(1);
        }
      });
  }
}

/**
 * Example usage:
 *
 * Single agent (simple):
 * codemachine run "code-generator 'Build login feature'"
 *
 * Single agent (enhanced with input files):
 * codemachine run "system-analyst[input:.codemachine/agents/system-analyst.md,tail:100] 'analyze architecture'"
 *
 * Single agent (multiple inputs, no prompt):
 * codemachine run "arch-writer[input:file1.md;file2.md;file3.md]"
 *
 * Orchestration (parallel):
 * codemachine run "frontend[tail:50] 'UI' & backend[tail:50] 'API' & db[tail:30] 'schema'"
 *
 * Orchestration (sequential):
 * codemachine run "db 'Setup schema' && backend 'Create models' && api 'Build endpoints'"
 *
 * Orchestration (mixed):
 * codemachine run "db[tail:50] 'setup' && frontend[input:design.md,tail:100] & backend[input:api-spec.md,tail:100]"
 */
