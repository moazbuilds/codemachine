import React from 'react';
import { Box, Text } from 'ink';
import { formatTokens, formatNumber } from '../utils/formatters';

export interface TelemetryBarProps {
  workflowName: string;
  runtime: string;
  total: {
    tokensIn: number;
    tokensOut: number;
    cached?: number;
  };
}

/**
 * Show workflow info and total telemetry in footer
 */
export const TelemetryBar: React.FC<TelemetryBarProps> = ({ workflowName, runtime, total }) => {
  const totalText = `${formatTokens(total.tokensIn, total.tokensOut)}${
    total.cached ? ` (${formatNumber(total.cached)} cached)` : ''
  }`;

  return (
    <Box
      paddingX={1}
      paddingBottom={1}
      borderStyle="round"
      justifyContent="space-between"
      width="100%"
    >
      <Text>
        <Text bold>{workflowName}</Text>
        <Text dimColor> • {runtime}</Text>
      </Text>
      <Text>
        <Text dimColor>Tokens: </Text>
        {totalText}
      </Text>
    </Box>
  );
};
