import type { Command } from 'commander';
import { OrchestrationService, EnhancedCommandParser, InputFileProcessor } from '../../agents/orchestration/index.js';
import { executeAgent } from '../../agents/execution/index.js';
import { loadAgentTemplate } from '../../agents/execution/config.js';
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
 */
async function runScript(script: string, options: RunCommandOptions): Promise<void> {
  const trimmed = script.trim();

  // Smart detection: orchestration vs single agent
  const isOrchestration = trimmed.includes('&') || trimmed.includes('&&');

  if (isOrchestration) {
    // Orchestration mode
    console.log(chalk.bold('\n🎭 Running orchestration...\n'));
    const orchestrator = OrchestrationService.getInstance();
    await orchestrator.execute(trimmed, {
      workingDir: options.dir
    });
  } else {
    // Single agent mode
    console.log(chalk.bold('\n🤖 Running single agent...\n'));
    await runSingleAgent(trimmed, options);
  }
}

/**
 * Run a single agent with enhanced syntax
 */
async function runSingleAgent(script: string, options: RunCommandOptions): Promise<void> {
  // Parse the enhanced command
  const enhancedParser = new EnhancedCommandParser();
  const inputProcessor = new InputFileProcessor();

  // Try enhanced parsing
  let command = enhancedParser.tryParseEnhanced(script);

  // Fallback to simple parsing if not enhanced
  if (!command) {
    // Try simple quoted format: agent 'prompt'
    const quotedMatch = script.match(/^(\S+)\s+(['"])([^\2]+)\2$/);
    if (quotedMatch) {
      command = {
        name: quotedMatch[1],
        prompt: quotedMatch[3]
      };
    } else {
      // Try unquoted format: agent prompt
      const spaceIndex = script.indexOf(' ');
      if (spaceIndex > 0) {
        command = {
          name: script.substring(0, spaceIndex),
          prompt: script.substring(spaceIndex + 1).trim()
        };
      } else {
        // Just agent name (no prompt)
        command = {
          name: script
        };
      }
    }
  }

  console.log(chalk.cyan(`Agent: ${command.name}`));
  if (command.input && command.input.length > 0) {
    console.log(chalk.dim(`Input files: ${command.input.join(', ')}`));
  }
  if (command.tail) {
    console.log(chalk.dim(`Tail: ${command.tail} lines`));
  }
  console.log(chalk.dim(`Prompt: ${command.prompt || '(using template only)'}\n`));

  // Load input files if specified
  let inputContent = '';
  if (command.input && command.input.length > 0) {
    inputContent = await inputProcessor.loadInputFiles(command.input, options.dir);
  }

  // Load agent template
  const template = await loadAgentTemplate(command.name, options.dir);

  // Build composite prompt
  const compositePrompt = inputProcessor.buildCompositePrompt(
    inputContent,
    template,
    command.prompt
  );

  // Execute agent
  // If tail is specified, suppress real-time output to apply tail limiting
  const suppressOutput = command.tail !== undefined && command.tail > 0;

  const output = await executeAgent(command.name, compositePrompt, {
    workingDir: options.dir,
    model: options.model,
    // Suppress logging when tail is active - we'll show the tail-limited output after
    logger: suppressOutput ? () => {} : undefined,
    stderrLogger: suppressOutput ? () => {} : undefined
  });

  // Apply tail limiting if specified
  let finalOutput = output;
  if (command.tail && command.tail > 0) {
    const lines = output.split('\n');
    if (lines.length > command.tail) {
      finalOutput = lines.slice(-command.tail).join('\n');
      console.log(chalk.dim(`\n(Output limited to last ${command.tail} lines of ${lines.length} total)\n`));
    }
  }

  // Print output only if we suppressed it earlier (tail mode)
  // Otherwise it was already streamed during execution
  if (suppressOutput) {
    console.log('\n' + chalk.bold('═'.repeat(60)));
    console.log(chalk.bold('Agent Output'));
    console.log(chalk.bold('═'.repeat(60)) + '\n');
    console.log(finalOutput);
    console.log('\n' + chalk.dim('─'.repeat(60)) + '\n');
  }
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
