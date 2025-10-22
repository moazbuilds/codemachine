import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { AgentState, SubAgentState, TriggeredAgentState } from '../state/types';
import { formatTokens, formatNumber } from '../utils/formatters';
import { useCtrlCHandler } from '../hooks/useCtrlCHandler';
import { calculateDuration } from '../utils/calculateDuration';

export interface TelemetryDetailViewProps {
  allAgents: AgentState[];
  subAgents: Map<string, SubAgentState[]>;
  triggeredAgents: TriggeredAgentState[];
  cumulativeStats: {
    totalTokensIn: number;
    totalTokensOut: number;
    totalCost?: number;
    totalDuration?: number;
    totalCached?: number;
    loopIterations?: number;
  };
  onClose: () => void;
}

/**
 * Full-screen telemetry view with per-agent breakdown
 * Activated by pressing T key
 */
export const TelemetryDetailView: React.FC<TelemetryDetailViewProps> = ({
  allAgents,
  subAgents,
  triggeredAgents,
  cumulativeStats,
  onClose,
}) => {
  // Keyboard handling
  useCtrlCHandler();
  useInput((input, key) => {
    if (input === 't' || input === 'q' || key.escape) {
      onClose();
    }
  });

  // Calculate aggregate metrics
  let totalSubAgents = 0;
  let subAgentTokensIn = 0;
  let subAgentTokensOut = 0;
  let subAgentCached = 0;

  for (const subAgentList of subAgents.values()) {
    totalSubAgents += subAgentList.length;
    for (const sub of subAgentList) {
      subAgentTokensIn += sub.telemetry.tokensIn;
      subAgentTokensOut += sub.telemetry.tokensOut;
      subAgentCached += sub.telemetry.cached || 0;
    }
  }

  const avgSubAgentIn = totalSubAgents > 0 ? Math.round(subAgentTokensIn / totalSubAgents) : 0;
  const avgSubAgentOut = totalSubAgents > 0 ? Math.round(subAgentTokensOut / totalSubAgents) : 0;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box paddingY={1} borderStyle="single" borderColor="cyan">
        <Text bold>🤖 CodeMachine • Workflow Telemetry Dashboard</Text>
      </Box>

      <Box flexDirection="column" paddingY={1}>
        <Text bold underline>Per-Agent Telemetry</Text>

        <Box paddingTop={1}>
          <Box width={30}>
            <Text bold>Agent</Text>
          </Box>
          <Box width={15}>
            <Text bold>Duration</Text>
          </Box>
          <Box width={25}>
            <Text bold>Tokens (in/out)</Text>
          </Box>
          <Box width={15}>
            <Text bold>Cached</Text>
          </Box>
        </Box>

        {allAgents.map((agent, index) => (
          <AgentTelemetryRow key={agent.id} agent={agent} index={index + 1} />
        ))}
      </Box>

      {totalSubAgents > 0 && (
        <Box flexDirection="column" paddingY={1}>
          <Text bold underline>Sub-Agents Summary</Text>
          <Box paddingTop={1}>
            <Text>
              Total sub-agents: {totalSubAgents} • Tokens: {formatTokens(subAgentTokensIn, subAgentTokensOut)}
              {subAgentCached > 0 && ` • ${formatNumber(subAgentCached)} cached`}
            </Text>
          </Box>
          <Box>
            <Text dimColor>
              Average per sub-agent: {formatTokens(avgSubAgentIn, avgSubAgentOut)}
            </Text>
          </Box>
        </Box>
      )}

      {triggeredAgents.length > 0 && (
        <Box flexDirection="column" paddingY={1}>
          <Text bold underline>Triggered Agents ({triggeredAgents.length})</Text>
          {triggeredAgents.map((agent) => (
            <AgentTelemetryRow key={agent.id} agent={agent} index={0} isTriggered />
          ))}
        </Box>
      )}

      <Box flexDirection="column" paddingY={1} borderStyle="single" borderColor="cyan">
        <Text bold>Grand Total</Text>
        <Box paddingTop={1}>
          <Text>
            Total tokens: {formatTokens(cumulativeStats.totalTokensIn, cumulativeStats.totalTokensOut)}
            {cumulativeStats.totalCached && cumulativeStats.totalCached > 0 && (
              <Text> • {formatNumber(cumulativeStats.totalCached)} cached</Text>
            )}
            {cumulativeStats.totalCost && (
              <Text> • Total cost: ${cumulativeStats.totalCost.toFixed(4)}</Text>
            )}
          </Text>
        </Box>
        {cumulativeStats.loopIterations && cumulativeStats.loopIterations > 1 && (
          <Box paddingTop={1}>
            <Text color="yellow">
              Loop iterations: {cumulativeStats.loopIterations}
            </Text>
          </Box>
        )}
      </Box>

      <Box paddingY={1}>
        <Text dimColor>Press [T] to return to workflow view • [Q] to quit</Text>
      </Box>
    </Box>
  );
};

/**
 * Single row in telemetry table
 */
const AgentTelemetryRow: React.FC<{
  agent: AgentState | SubAgentState | TriggeredAgentState;
  index: number;
  isTriggered?: boolean;
}> = ({ agent, index, isTriggered }) => {
  const duration = calculateDuration(
    {
      startTime: agent.startTime,
      endTime: agent.endTime,
      status: agent.status,
    },
    { fallback: '-' }
  );

  const prefix = isTriggered ? '⚡ ' : index > 0 ? `${index.toString().padStart(2, '0')}. ` : '   ';

  return (
    <Box>
      <Box width={30}>
        <Text>
          {prefix}
          {agent.name}
        </Text>
      </Box>
      <Box width={15}>
        <Text>{duration}</Text>
      </Box>
      <Box width={25}>
        <Text>{formatTokens(agent.telemetry.tokensIn, agent.telemetry.tokensOut)}</Text>
      </Box>
      <Box width={15}>
        <Text dimColor>{agent.telemetry.cached ? formatNumber(agent.telemetry.cached) : '-'}</Text>
      </Box>
    </Box>
  );
};
