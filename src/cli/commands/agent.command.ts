import type { Command } from 'commander';

import { executeAgent } from '../../agents/execution/index.js';

type AgentCommandOptions = {
  model?: string;
};

/**
 * Registers the main agent command (uses engine from config or defaults to first registered engine)
 */
async function registerMainAgentCommand(program: Command): Promise<void> {
  // Import registry to get default engine name
  const { registry } = await import('../../infra/engines/index.js');
  const defaultEngine = registry.getDefault();
  const defaultEngineName = defaultEngine?.metadata.name ?? 'default engine';

  program
    .command('agent')
    .description(`Execute agent with engine from config (defaults to ${defaultEngineName})`)
    .argument('<id>', 'Agent id from config/sub.agents.js or config/main.agents.js')
    .argument('<prompt...>', 'User request to send to the agent')
    .option('--model <model>', 'Model to use (overrides agent config)')
    .action(async (id: string, promptParts: string[], options: AgentCommandOptions) => {
      const prompt = promptParts.join(' ').trim();
      if (!prompt) {
        throw new Error('Prompt is required');
      }

      await executeAgent(id, prompt, {
        workingDir: process.cwd(),
        model: options.model,
      });
    });
}

/**
 * Registers engine-specific agent commands (dynamically from registry)
 */
function registerEngineAgentCommands(program: Command): void {
  // Import registry dynamically to avoid circular dependencies
  import('../../infra/engines/index.js').then(({ registry }) => {
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
        .option('--model <model>', 'Model to use (overrides agent config)')
        .action(async (id: string, promptParts: string[], options: AgentCommandOptions) => {
          const prompt = promptParts.join(' ').trim();
          if (!prompt) {
            throw new Error('Prompt is required');
          }

          await executeAgent(id, prompt, {
            engine: engine.metadata.id,
            workingDir: process.cwd(),
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
export async function registerAgentCommand(program: Command): Promise<void> {
  await registerMainAgentCommand(program);
  registerEngineAgentCommands(program);
}
