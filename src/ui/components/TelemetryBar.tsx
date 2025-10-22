import React from 'react';
import { Box, Text } from 'ink';
import { formatTokens, formatNumber } from '../utils/formatters';
import { ShimmerText } from './ShimmerText';
import type { WorkflowStatus } from '../state/types';

export interface TelemetryBarProps {
  workflowName: string;
  runtime: string;
  status: WorkflowStatus;
  total: {
    tokensIn: number;
    tokensOut: number;
    cached?: number;
  };
}

/**
 * Show workflow info, status, and total telemetry in footer
 */
export const TelemetryBar: React.FC<TelemetryBarProps> = ({ workflowName, runtime, status, total }) => {
  const totalText = `${formatTokens(total.tokensIn, total.tokensOut)}${
    total.cached ? ` (${formatNumber(total.cached)} cached)` : ''
  }`;

  // Render status with animation for running state
  const statusElement = (() => {
    switch (status) {
      case 'running':
        return <ShimmerText text="Running..." sweepSeconds={2.0} bandHalfWidth={2.5} />;
      case 'stopping':
        return <Text color="yellow">⚠ Press Ctrl+C again to close the session</Text>;
      case 'completed':
        return <Text color="green">● Completed</Text>;
      case 'stopped':
        return <Text color="red">⏹ Stopped by user</Text>;
      default:
        return null;
    }
  })();

  return (
    <Box
      paddingX={1}
      paddingTop={0}
      paddingBottom={0}
      borderStyle="round"
      justifyContent="space-between"
      width="100%"
    >
      <Text>
        <Text bold>{workflowName}</Text>
        <Text dimColor> • {runtime}</Text>
        <Text> • </Text>
        {statusElement}
      </Text>
      <Text>
        <Text dimColor>Tokens: </Text>
        {totalText}
      </Text>
    </Box>
  );
};
