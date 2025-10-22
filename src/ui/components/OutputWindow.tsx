import React, { useMemo } from 'react';
import { Box, Text, useStdout } from 'ink';
import type { AgentState, SubAgentState } from '../state/types';
import { calculateOutputWindowHeight } from '../utils/heightCalculations';
import { useTerminalResize } from '../hooks/useTerminalResize';
import { useLogStream } from '../hooks/useLogStream';

export interface OutputWindowProps {
  currentAgent: AgentState | SubAgentState | null;
  outputLines: string[];
  maxLines?: number;
  getMonitoringId: (uiId: string) => number | undefined;
}

/**
 * Output window showing current agent's output
 * Displays last N lines with syntax highlighting
 *
 * For main agents: Uses in-memory outputLines buffer
 * For sub-agents: Streams from log files using useLogStream
 */
export const OutputWindow: React.FC<OutputWindowProps> = ({
  currentAgent,
  outputLines,
  maxLines,
  getMonitoringId,
}) => {
  const { stdout } = useStdout();
  const _terminalSize = useTerminalResize();

  // Calculate available height dynamically using centralized utility
  // Recalculates when terminal size changes
  const calculatedHeight = calculateOutputWindowHeight(stdout);
  const effectiveMaxLines = maxLines || calculatedHeight;

  // Detect if current agent is a sub-agent
  const isSubAgent = currentAgent && 'parentId' in currentAgent;
  const monitoringId = currentAgent ? getMonitoringId(currentAgent.id) : undefined;

  // Use log stream for sub-agents
  const { lines: logLines, isLoading, error } = useLogStream(
    isSubAgent ? monitoringId : undefined
  );

  if (!currentAgent) {
    return (
      <Box flexDirection="column" width="100%" height={effectiveMaxLines} justifyContent="center" alignItems="center">
        <Text dimColor>No agent selected</Text>
      </Box>
    );
  }

  const agentType = isSubAgent ? 'sub-agent' : 'main';

  // Determine which lines to display
  const sourceLines = isSubAgent ? logLines : outputLines;

  const visibleLines = useMemo(() => {
    if (sourceLines.length > effectiveMaxLines) {
      return sourceLines.slice(sourceLines.length - effectiveMaxLines);
    }
    return sourceLines;
  }, [sourceLines, effectiveMaxLines]);

  // Prepare output lines as React nodes
  const outputNodes = useMemo(() =>
    visibleLines.map((line, index) => (
      <OutputLine key={index} line={line} />
    )),
    [visibleLines]
  );

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* Header - Fixed height */}
      <Box paddingX={1} paddingBottom={1} justifyContent="space-between">
        <Text bold underline>
          Output: {currentAgent.name}
        </Text>
        <Text dimColor>
          [{agentType}] [{currentAgent.engine}] [{currentAgent.status}]
        </Text>
      </Box>

      {/* Output area */}
      <Box paddingX={1} height={effectiveMaxLines} flexDirection="column">
        {isSubAgent && isLoading ? (
          <Text dimColor>Loading logs...</Text>
        ) : isSubAgent && error ? (
          <Text color="red">Error loading logs: {error}</Text>
        ) : sourceLines.length === 0 ? (
          <Text dimColor>Waiting for output...</Text>
        ) : (
          <Box flexDirection="column">{outputNodes}</Box>
        )}
      </Box>
    </Box>
  );
};

/**
 * Single output line with syntax highlighting
 */
const OutputLine: React.FC<{ line: string }> = ({ line }) => {
  // Detect and highlight different output types
  if (line.includes('🔧 TOOL')) {
    return <Text color="cyan">{line}</Text>;
  }
  if (line.includes('🧠 THINKING')) {
    return <Text color="magenta">{line}</Text>;
  }
  if (line.includes('💬 TEXT') || line.includes('💬 MESSAGE')) {
    return <Text>{line}</Text>;
  }
  if (line.includes('⏱️') || line.includes('Tokens:')) {
    return <Text color="yellow">{line}</Text>;
  }
  if (line.includes('ERROR') || line.includes('✗')) {
    return <Text color="red">{line}</Text>;
  }
  if (line.includes('✅') || line.includes('✓')) {
    return <Text color="green">{line}</Text>;
  }

  // Default
  return <Text>{line}</Text>;
};
