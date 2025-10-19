import React from 'react';
import { Box, Text } from 'ink';
import { formatTokens, formatNumber } from '../utils/formatters';

export interface TelemetryBarProps {
  current?: {
    tokensIn: number;
    tokensOut: number;
    cost?: number;
    duration?: number;
    cached?: number;
    engine: 'claude' | 'codex' | 'cursor';
    isSubAgent?: boolean;
  };
  cumulative: {
    tokensIn: number;
    tokensOut: number;
    cost?: number;
    avgDuration?: number;
    cached?: number;
  };
}

/**
 * Show current agent and cumulative workflow telemetry
 * Engine display updates dynamically when user navigates
 */
export const TelemetryBar: React.FC<TelemetryBarProps> = ({
  current,
  cumulative,
}) => {
  const currentText = current
    ? `Current: ${formatTokens(current.tokensIn, current.tokensOut)}${
        current.cached ? ` (${formatNumber(current.cached)} cached)` : ''
      }${current.isSubAgent ? ' (sub-agent)' : ''}`
    : 'Current: No agent selected';

  const cumulativeText = `Workflow Total: ${formatTokens(
    cumulative.tokensIn,
    cumulative.tokensOut
  )}${cumulative.cached ? ` (${formatNumber(cumulative.cached)} cached)` : ''}`;

  const engineText = current ? `Engine: ${current.engine}` : '';

  const costText =
    current?.cost !== undefined
      ? ` • Cost: $${current.cost.toFixed(4)}`
      : cumulative.cost !== undefined
      ? ` • Total Cost: $${cumulative.cost.toFixed(4)}`
      : '';

  return (
    <Box paddingX={1} borderStyle="single">
      <Text>
        {currentText} • {cumulativeText}
        {engineText && ` • ${engineText}`}
        {costText}
      </Text>
    </Box>
  );
};
