import React from 'react';
import { Box, Text } from 'ink';
import type { AgentState } from '../state/types';
import { getStatusIcon, getStatusColor } from '../utils/statusIcons';
import { formatDuration, formatTokens } from '../utils/formatters';

export interface MainAgentNodeProps {
  agent: AgentState;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * Display a single main agent with status, telemetry, and duration
 */
export const MainAgentNode: React.FC<MainAgentNodeProps> = ({
  agent,
  index,
  isSelected,
}) => {
  const icon = getStatusIcon(agent.status);
  const color = getStatusColor(agent.status);
  const prefix = isSelected ? '> ' : '  ';

  // Calculate duration
  let duration = '';
  if (agent.endTime) {
    const seconds = (agent.endTime - agent.startTime) / 1000;
    duration = formatDuration(seconds);
  } else if (agent.status === 'running') {
    const seconds = (Date.now() - agent.startTime) / 1000;
    duration = formatDuration(seconds);
  }

  // Build telemetry display
  const { tokensIn, tokensOut } = agent.telemetry;
  const tokenStr = tokensIn > 0 || tokensOut > 0 ? formatTokens(tokensIn, tokensOut) : '';

  // Activity counts
  const activities: string[] = [];
  if (agent.toolCount > 0) {
    activities.push(`${agent.toolCount} tools`);
  }
  if (agent.thinkingCount > 0) {
    activities.push(`${agent.thinkingCount} thinking`);
  }
  const activityStr = activities.length > 0 ? ` • ${activities.join(', ')}` : '';

  return (
    <Box paddingX={1}>
      <Text>
        {prefix}
        <Text color={color}>{icon}</Text>
        {' '}
        <Text bold>{agent.name}</Text>
        {' '}
        <Text dimColor>({agent.engine})</Text>
        {duration && <Text> • {duration}</Text>}
        {tokenStr && <Text dimColor> • {tokenStr}</Text>}
        {activityStr && <Text dimColor>{activityStr}</Text>}
        {agent.error && <Text color="red"> • Error: {agent.error}</Text>}
      </Text>
    </Box>
  );
};
