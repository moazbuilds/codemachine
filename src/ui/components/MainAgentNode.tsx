import React from 'react';
import { Box, Text } from 'ink';
import { SharedSpinner } from '../contexts/SpinnerContext';
import type { AgentState } from '../state/types';
import { getStatusIcon, getStatusColor } from '../utils/statusIcons';
import { formatTokens } from '../utils/formatters';
import { calculateDuration } from '../utils/calculateDuration';
import { debug } from '../../shared/logging/logger.js';

export interface MainAgentNodeProps {
  agent: AgentState;
  isSelected: boolean;
}

/**
 * Display a single main agent with status, telemetry, and duration
 */
export const MainAgentNode: React.FC<MainAgentNodeProps> = ({ agent, isSelected }) => {
  const color = getStatusColor(agent.status);

  const duration = calculateDuration({
    startTime: agent.startTime,
    endTime: agent.endTime,
    status: agent.status,
  });

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

  const hasLoopRound = agent.loopRound && agent.loopRound > 0;

  // Main agent line (same for both cases)
  const mainLine = (
    <Text>
      {isSelected && <Text color="white">&gt; </Text>}
      {!isSelected && '  '}
      {agent.status === 'running' ? (
        <Text color="white">
          <SharedSpinner />
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
  );

  // If loop round exists, show cycle on separate line below
  if (hasLoopRound) {
    // Debug: log loop reason
    debug(`MainAgentNode: loopRound=${agent.loopRound}, loopReason="${agent.loopReason}"`);
    return (
      <Box paddingX={1} flexDirection="column">
        {mainLine}
        <Box paddingLeft={2}>
          <Text bold color="cyan">
            ⎿ Cycle {agent.loopRound}{agent.loopReason ? ` - ${agent.loopReason}` : ''}
          </Text>
        </Box>
      </Box>
    );
  }

  // Normal single-line display
  return (
    <Box paddingX={1}>
      {mainLine}
    </Box>
  );
};
