import { Command } from 'commander';
import { listAgents } from './list.js';
import { showAgentLogs } from './logs.js';
import { exportAgents } from './export.js';

/**
 * Main agents command - routes to list or logs based on subcommand
 */
export function createAgentsCommand(): Command {
  const command = new Command('agents')
    .description('Manage and monitor agents');

  // agents list (or just agents)
  command
    .command('list', { isDefault: true })
    .description('List all active and offline agents')
    .action(() => {
      listAgents();
    });

  // agents logs <id>
  command
    .command('logs <id>')
    .description('View logs for a specific agent')
    .action(async (id: string) => {
      const agentId = parseInt(id, 10);
      if (isNaN(agentId)) {
        console.error(`Invalid agent ID: ${id}`);
        process.exit(1);
      }
      await showAgentLogs(agentId);
    });

  // agents export
  command
    .command('export')
    .description('Export agent registry to JSON')
    .action(async () => {
      await exportAgents();
    });

  return command;
}
