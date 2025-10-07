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
 * Registers engine-specific agent commands (claude/codex)
 */
function registerEngineAgentCommands(program: Command): void {
  // Register claude subcommand
  const claudeCommand = program
    .command('claude')
    .description('Use Claude engine for agent execution');

  claudeCommand
    .command('agent')
    .description('Execute Claude with an agent wrapper')
    .argument('<id>', 'Agent id from config/sub.agents.js or config/main.agents.js')
    .argument('<prompt...>', 'User request to send to the agent')
    .option('--profile <profile>', 'Claude profile to use (defaults to the agent id)')
    .option('--model <model>', 'Model to use (overrides agent config)')
    .action(async (id: string, promptParts: string[], options: AgentCommandOptions) => {
      const prompt = promptParts.join(' ').trim();
      if (!prompt) {
        throw new Error('Prompt is required');
      }

      await executeAgent(id, prompt, {
        engine: 'claude',
        workingDir: process.cwd(),
        profile: options.profile,
        model: options.model,
      });
    });

  // Register codex subcommand
  const codexCommand = program
    .command('codex')
    .description('Use Codex engine for agent execution');

  codexCommand
    .command('agent')
    .description('Execute Codex with an agent wrapper')
    .argument('<id>', 'Agent id from config/sub.agents.js or config/main.agents.js')
    .argument('<prompt...>', 'User request to send to the agent')
    .option('--profile <profile>', 'Codex profile to use (defaults to the agent id)')
    .option('--model <model>', 'Model to use (overrides agent config)')
    .action(async (id: string, promptParts: string[], options: AgentCommandOptions) => {
      const prompt = promptParts.join(' ').trim();
      if (!prompt) {
        throw new Error('Prompt is required');
      }

      await executeAgent(id, prompt, {
        engine: 'codex',
        workingDir: process.cwd(),
        profile: options.profile,
        model: options.model,
      });
    });
}

/**
 * Registers all agent-related commands
 */
export function registerAgentCommand(program: Command): void {
  registerMainAgentCommand(program);
  registerEngineAgentCommands(program);
}
