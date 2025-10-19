import type { AgentStatus } from '../state/types';

/**
 * Get status icon for agent
 */
export function getStatusIcon(status: AgentStatus): string {
  switch (status) {
    case 'pending':
      return '○';  // Empty circle
    case 'running':
      return '⠋';  // Spinner (will animate in Ink)
    case 'completed':
      return '✓';  // Checkmark
    case 'failed':
      return '✗';  // X mark
    case 'skipped':
      return '●';  // Filled circle
    case 'paused':
      return '⏸';  // Pause symbol
    case 'retrying':
      return '⟳';  // Retry symbol
    default:
      return '?';
  }
}

/**
 * Get color for status (Ink color names)
 */
export function getStatusColor(status: AgentStatus): string {
  switch (status) {
    case 'completed':
      return 'green';
    case 'failed':
      return 'red';
    case 'running':
      return 'blue';
    case 'paused':
      return 'yellow';
    default:
      return 'white';
  }
}
