import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
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
  index: _index,
  isSelected,
}) => {
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
    <Box flexDirection="column">
      <Box paddingX={1}>
        <Text>
          {prefix}
          {agent.status === 'running' ? (
            <Text color={color}>
              <Spinner type="dots" />
            </Text>
          ) : (
            <Text color={color}>{getStatusIcon(agent.status)}</Text>
          )}
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
      {agent.loopRound && agent.loopRound > 0 && (
        <Box paddingX={1}>
          <Text dimColor>  ⎿  Round {agent.loopRound}</Text>
        </Box>
      )}
    </Box>
  );
};
