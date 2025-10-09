import type { Command } from 'commander';

import { executeAgent } from '../../agents/execution/index.js';

type AgentCommandOptions = {
  profile?: string;
  model?: string;
};

/**
 * Registers the main agent command (uses engine from config or defaults to codex)
 */
function registerMainAgentCommand(program: Command): void {
  program
    .command('agent')
    .description('Execute agent with engine from config (defaults to Codex)')
    .argument('<id>', 'Agent id from config/sub.agents.js or config/main.agents.js')
    .argument('<prompt...>', 'User request to send to the agent')
    .option('--profile <profile>', 'Engine profile to use (defaults to the agent id)')
    .option('--model <model>', 'Model to use (overrides agent config)')
    .action(async (id: string, promptParts: string[], options: AgentCommandOptions) => {
      const prompt = promptParts.join(' ').trim();
      if (!prompt) {
        throw new Error('Prompt is required');
      }

      await executeAgent(id, prompt, {
        workingDir: process.cwd(),
        profile: options.profile,
        model: options.model,
      });
    });
}

/**
 * Registers engine-specific agent commands (dynamically from registry)
 */
function registerEngineAgentCommands(program: Command): void {
  // Import registry dynamically to avoid circular dependencies
  import('../../infra/engines/registry.js').then(({ registry }) => {
    // Register a subcommand for each engine in the registry
    for (const engine of registry.getAll()) {
      const engineCommand = program
        .command(engine.metadata.cliCommand)
        .description(`Use ${engine.metadata.name} engine for agent execution`);

      engineCommand
        .command('agent')
        .description(`Execute ${engine.metadata.name} with an agent wrapper`)
        .argument('<id>', 'Agent id from config/sub.agents.js or config/main.agents.js')
        .argument('<prompt...>', 'User request to send to the agent')
        .option('--profile <profile>', `${engine.metadata.name} profile to use (defaults to the agent id)`)
        .option('--model <model>', 'Model to use (overrides agent config)')
        .action(async (id: string, promptParts: string[], options: AgentCommandOptions) => {
          const prompt = promptParts.join(' ').trim();
          if (!prompt) {
            throw new Error('Prompt is required');
          }

          await executeAgent(id, prompt, {
            engine: engine.metadata.id,
            workingDir: process.cwd(),
            profile: options.profile,
            model: options.model,
          });
        });
    }
  }).catch(error => {
    console.error('Failed to register engine-specific agent commands:', error);
  });
}

/**
 * Registers all agent-related commands
 */
export function registerAgentCommand(program: Command): void {
  registerMainAgentCommand(program);
  registerEngineAgentCommands(program);
}
