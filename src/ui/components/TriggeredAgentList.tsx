import React from 'react';
import { Box, Text } from 'ink';
import { SharedSpinner } from '../contexts/SpinnerContext';
import type { TriggeredAgentState } from '../state/types';
import { getStatusIcon, getStatusColor } from '../utils/statusIcons';
import { formatTokens } from '../utils/formatters';
import { calculateDuration } from '../utils/calculateDuration';

export const MAX_TRIGGERED_AGENTS_DISPLAYED = 5;

export interface TriggeredAgentListProps {
  triggeredAgents: TriggeredAgentState[];
}

/**
 * Show triggered agents with attribution to source agent
 * Limits display to first 5 agents to avoid screen overflow
 */
export const TriggeredAgentList: React.FC<TriggeredAgentListProps> = ({
  triggeredAgents,
}) => {
  if (triggeredAgents.length === 0) {
    return null;
  }

  const displayAgents = triggeredAgents.slice(0, MAX_TRIGGERED_AGENTS_DISPLAYED);
  const remaining = triggeredAgents.length - MAX_TRIGGERED_AGENTS_DISPLAYED;

  return (
    <Box flexDirection="column" paddingX={1} marginTop={1}>
      <Text bold>Triggered Agents:</Text>
      {displayAgents.map((agent) => {
        const color = getStatusColor(agent.status);

        const duration = calculateDuration({
          startTime: agent.startTime,
          endTime: agent.endTime,
          status: agent.status,
        });

        // Telemetry
        const { tokensIn, tokensOut } = agent.telemetry;
        const tokenStr = tokensIn > 0 || tokensOut > 0 ? formatTokens(tokensIn, tokensOut) : '';

        return (
          <Box key={agent.id} paddingLeft={2}>
            <Text>
              {agent.status === 'running' ? (
                <Text color="white">
                  <SharedSpinner />
                </Text>
              ) : (
                <Text color={color}>{getStatusIcon(agent.status)}</Text>
              )}
              {' '}
              {agent.name}
              {' '}
              <Text dimColor>({agent.engine})</Text>
              {' '}
              <Text color="cyan">← {agent.triggeredBy}</Text>
              {' '}
              <Text dimColor>[{agent.triggerCondition}]</Text>
              {duration && <Text> • {duration}</Text>}
              {tokenStr && <Text dimColor> • {tokenStr}</Text>}
              {agent.error && <Text color="red"> • Error: {agent.error}</Text>}
            </Text>
          </Box>
        );
      })}
      {remaining > 0 && (
        <Box paddingLeft={2}>
          <Text dimColor>+{remaining} more</Text>
        </Box>
      )}
    </Box>
  );
};
