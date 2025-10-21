import type { Command } from 'commander';
import { createAgentsCommand } from './index.js';

/**
 * Register the agents command with the CLI program
 */
export function registerAgentsCommand(program: Command): void {
  const agentsCommand = createAgentsCommand();
  program.addCommand(agentsCommand);
}
