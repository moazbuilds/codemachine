import React from 'react';
import { Box, Text } from 'ink';
import type { SubAgentState } from '../state/types';
import { formatTokens } from '../utils/formatters';

export interface SubAgentSummaryProps {
  subAgents: SubAgentState[];
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
}

/**
 * Collapsed view showing sub-agent counts and aggregate telemetry
 */
export const SubAgentSummary: React.FC<SubAgentSummaryProps> = ({
  subAgents,
  isExpanded,
  isSelected,
}) => {
  if (subAgents.length === 0) {
    return null;
  }

  const arrow = isExpanded ? '▼' : '▶';
  const showArrow = isSelected;

  // Count by status
  const counts = {
    completed: 0,
    running: 0,
    pending: 0,
  };

  let totalIn = 0;
  let totalOut = 0;

  for (const agent of subAgents) {
    if (agent.status in counts) {
      counts[agent.status as keyof typeof counts]++;
    }
    totalIn += agent.telemetry.tokensIn;
    totalOut += agent.telemetry.tokensOut;
  }

  const statusParts: string[] = [];
  if (counts.completed > 0) statusParts.push(`${counts.completed} completed`);
  if (counts.running > 0) statusParts.push(`${counts.running} running`);
  if (counts.pending > 0) statusParts.push(`${counts.pending} pending`);

  const statusStr = statusParts.join(', ');
  const tokenStr = totalIn > 0 || totalOut > 0 ? formatTokens(totalIn, totalOut) : '';

  return (
    <Box paddingX={1}>
      <Text>
        {showArrow && <Text color="white">&gt; </Text>}
        {!showArrow && '  '}
        <Text dimColor>{arrow} Sub-agents: {statusStr}{tokenStr && ` • ${tokenStr}`}</Text>
      </Text>
    </Box>
  );
};
