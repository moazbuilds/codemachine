import { AgentMonitorService, type AgentTreeNode, type AgentRecord } from '../../../agents/monitoring/index.js';
import chalk from 'chalk';

/**
 * Display all agents in a hierarchical tree view
 */
export function listAgents(): void {
  const monitor = AgentMonitorService.getInstance();

  const activeAgents = monitor.getActiveAgents();
  const offlineAgents = monitor.getOfflineAgents();

  console.log('');

  // Active agents section
  if (activeAgents.length > 0) {
    console.log(chalk.bold.green(`ACTIVE AGENTS (${activeAgents.length} running)`));

    // Build tree for active agents only
    const activeRoots = activeAgents.filter(a => !a.parentId);
    const activeTrees = activeRoots.map(root => buildTreeNode(root, monitor));

    activeTrees.forEach((tree, index) => {
      printTreeNode(tree, '', index === activeTrees.length - 1);
    });

    console.log('');
  }

  // Offline agents section
  if (offlineAgents.length > 0) {
    console.log(chalk.bold.gray(`OFFLINE AGENTS (${offlineAgents.length} terminated)`));

    offlineAgents.forEach((agent, index) => {
      const isLast = index === offlineAgents.length - 1;
      printOfflineAgent(agent, isLast);
    });

    console.log('');
  }

  // Summary
  const total = activeAgents.length + offlineAgents.length;
  console.log(chalk.dim('─'.repeat(60)));
  console.log(chalk.dim(`Total: ${total} agents (${activeAgents.length} active, ${offlineAgents.length} offline)`));
  console.log('');
}

/**
 * Build tree node with children
 */
function buildTreeNode(agent: AgentRecord, monitor: AgentMonitorService): AgentTreeNode {
  const children = monitor.getChildren(agent.id);
  return {
    agent,
    children: children.map(child => buildTreeNode(child, monitor))
  };
}

/**
 * Print a tree node with proper indentation and connectors
 */
function printTreeNode(node: AgentTreeNode, prefix: string, isLast: boolean): void {
  const { agent } = node;
  const connector = isLast ? '└─' : '├─';
  const tag = agent.parentId ? chalk.cyan('[SUB]') : chalk.magenta('[MAIN]');

  // Calculate uptime for running agents
  const uptime = agent.status === 'running'
    ? formatDuration(new Date().getTime() - new Date(agent.startTime).getTime())
    : '';

  // Status indicator
  const statusColor = agent.status === 'running' ? chalk.green : chalk.gray;
  const statusText = statusColor(agent.status === 'running' ? 'Running' : 'Completed');

  console.log(`${prefix}${connector} ${tag} ${chalk.bold(agent.name)}`);
  console.log(`${prefix}${isLast ? ' ' : '│'}   ${chalk.dim('ID:')} ${agent.id} ${chalk.dim('|')} ${chalk.dim('Status:')} ${statusText}${uptime ? ` ${chalk.dim('|')} ${chalk.dim('Uptime:')} ${uptime}` : ''}`);

  if (agent.prompt.length > 60) {
    console.log(`${prefix}${isLast ? ' ' : '│'}   ${chalk.dim('Prompt:')} ${agent.prompt.substring(0, 57)}...`);
  } else {
    console.log(`${prefix}${isLast ? ' ' : '│'}   ${chalk.dim('Prompt:')} ${agent.prompt}`);
  }

  // Print children
  if (node.children.length > 0) {
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    node.children.forEach((child, index) => {
      printTreeNode(child, childPrefix, index === node.children.length - 1);
    });
  }
}

/**
 * Print an offline agent (no tree structure needed)
 */
function printOfflineAgent(agent: AgentRecord, isLast: boolean): void {
  const connector = isLast ? '└─' : '├─';

  // Status with color
  const statusColor = agent.status === 'completed' ? chalk.green : chalk.red;
  const statusText = statusColor(agent.status === 'completed' ? 'Completed' : 'Failed');

  // Format time range
  const startTime = new Date(agent.startTime).toLocaleString();
  const endTime = agent.endTime ? new Date(agent.endTime).toLocaleString() : 'N/A';
  const duration = agent.duration ? formatDuration(agent.duration) : 'N/A';

  console.log(`${connector} ${chalk.bold(agent.name)}`);
  console.log(`${isLast ? ' ' : '│'}   ${chalk.dim('ID:')} ${agent.id} ${chalk.dim('|')} ${chalk.dim('Status:')} ${statusText} ${chalk.dim('|')} ${chalk.dim('Duration:')} ${duration}`);
  console.log(`${isLast ? ' ' : '│'}   ${chalk.dim('Ran:')} ${startTime} → ${endTime}`);

  if (agent.error) {
    console.log(`${isLast ? ' ' : '│'}   ${chalk.red('Error:')} ${agent.error}`);
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
