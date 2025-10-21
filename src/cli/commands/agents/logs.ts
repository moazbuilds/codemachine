import { AgentMonitorService, AgentLoggerService } from '../../../agents/monitoring/index.js';
import chalk from 'chalk';

/**
 * Display logs for a specific agent
 */
export async function showAgentLogs(agentId: number): Promise<void> {
  const monitor = AgentMonitorService.getInstance();
  const loggerService = AgentLoggerService.getInstance();

  // Get agent record
  const agent = monitor.getAgent(agentId);

  if (!agent) {
    console.error(chalk.red(`Agent ${agentId} not found`));
    console.error(chalk.dim('Use "codemachine agents" to see all agents'));
    process.exit(1);
  }

  // Print header
  console.log('');
  console.log(chalk.bold(`Agent ${agentId} - ${agent.name}`));
  console.log(chalk.dim('─'.repeat(60)));
  console.log(`${chalk.dim('Status:')} ${getStatusWithColor(agent.status)}`);
  console.log(`${chalk.dim('Started:')} ${new Date(agent.startTime).toLocaleString()}`);

  if (agent.endTime) {
    console.log(`${chalk.dim('Ended:')} ${new Date(agent.endTime).toLocaleString()}`);
  }

  if (agent.duration) {
    console.log(`${chalk.dim('Duration:')} ${formatDuration(agent.duration)}`);
  }

  console.log(`${chalk.dim('Prompt:')} ${agent.prompt}`);

  if (agent.telemetry) {
    console.log(chalk.dim('Telemetry:'));
    console.log(`  ${chalk.dim('Tokens In:')} ${agent.telemetry.tokensIn}`);
    console.log(`  ${chalk.dim('Tokens Out:')} ${agent.telemetry.tokensOut}`);
    if (agent.telemetry.cached) {
      console.log(`  ${chalk.dim('Cached:')} ${agent.telemetry.cached}`);
    }
    if (agent.telemetry.cost) {
      console.log(`  ${chalk.dim('Cost:')} $${agent.telemetry.cost.toFixed(4)}`);
    }
  }

  console.log(chalk.dim('─'.repeat(60)));
  console.log(chalk.bold('Logs:'));
  console.log('');

  // Stream logs
  try {
    await loggerService.streamLogs(agentId, (chunk) => {
      process.stdout.write(chunk);
    });
  } catch (error) {
    console.error(chalk.red(`Error reading logs: ${error}`));
    process.exit(1);
  }

  console.log('');
}

/**
 * Get status with appropriate color
 */
function getStatusWithColor(status: string): string {
  switch (status) {
    case 'running':
      return chalk.green('Running');
    case 'completed':
      return chalk.green('Completed');
    case 'failed':
      return chalk.red('Failed');
    default:
      return chalk.gray(status);
  }
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
