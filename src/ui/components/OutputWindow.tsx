import React, { useMemo } from 'react';
import { Box, Text, useStdout } from 'ink';
import Spinner from 'ink-spinner';
import type { AgentState, SubAgentState } from '../state/types';
import { calculateOutputWindowHeight, calculateOutputWindowContentWidth, wrapText } from '../utils/heightCalculations';
import { useTerminalResize } from '../hooks/useTerminalResize';
import { useLogStream } from '../hooks/useLogStream';
import { LineSyntaxHighlight } from '../utils/lineSyntaxHighlight';
import { ShimmerText } from './ShimmerText';

export interface OutputWindowProps {
  currentAgent: AgentState | SubAgentState | null;
  maxLines?: number;
  getMonitoringId: (uiId: string) => number | undefined;
}

/**
 * Output window showing current agent's output
 * Displays last N lines with syntax highlighting
 *
 * Streams from log files using useLogStream for all agents
 */
export const OutputWindow: React.FC<OutputWindowProps> = ({
  currentAgent,
  maxLines,
  getMonitoringId,
}) => {
  const { stdout } = useStdout();
  useTerminalResize();

  // Calculate available dimensions dynamically using centralized utilities
  // Recalculates when terminal size changes
  const calculatedHeight = calculateOutputWindowHeight(stdout);
  const calculatedWidth = calculateOutputWindowContentWidth(stdout);
  const effectiveMaxLines = maxLines || calculatedHeight;

  // Debug: log width calculations
  if (process.env.DEBUG_OUTPUT_WIDTH) {
    console.log(`Terminal width: ${stdout?.columns}, Calculated content width: ${calculatedWidth}`);
  }

  // Get monitoring ID for log streaming
  const monitoringId = currentAgent ? getMonitoringId(currentAgent.id) : undefined;

  // Use log stream for all agents (main and sub-agents)
  const { lines: logLines, isLoading, isConnecting, error } = useLogStream(monitoringId);

  if (!currentAgent) {
    return (
      <Box flexDirection="column" flexGrow={1} height={effectiveMaxLines} justifyContent="center" alignItems="center">
        <Text dimColor>No agent selected</Text>
      </Box>
    );
  }

  const agentType = currentAgent && 'parentId' in currentAgent ? 'sub-agent' : 'main';

  // Use log lines for all agents
  const sourceLines = logLines;

  // Process lines for wrapping and truncation
  const processedLines = useMemo(() => {
    const lines = sourceLines.length > effectiveMaxLines
      ? sourceLines.slice(sourceLines.length - effectiveMaxLines)
      : sourceLines;

    // Process each line for wrapping/truncation
    const processed: string[] = [];
    for (const line of lines) {
      if (line.length <= calculatedWidth) {
        processed.push(line);
      } else {
        // Wrap long lines
        const wrapped = wrapText(line, calculatedWidth, 3); // Max 3 lines per original line
        processed.push(...wrapped);
      }
    }

    // Ensure we don't exceed the height limit after wrapping
    if (processed.length > effectiveMaxLines) {
      return processed.slice(processed.length - effectiveMaxLines);
    }

    return processed;
  }, [sourceLines, effectiveMaxLines, calculatedWidth]);

  // Prepare output lines as React nodes
  const outputNodes = useMemo(
    () =>
      processedLines.map((line, index) => (
        <LineSyntaxHighlight
          key={index}
          line={line}
        />
      )),
    [processedLines]
  );

  return (
    <Box flexDirection="column" flexGrow={1} height="100%">
      {/* Header - Fixed height */}
      <Box paddingX={1} paddingBottom={1} justifyContent="space-between">
        <Text bold underline>
          Output: {currentAgent.name}
        </Text>
        <Text dimColor>
          [{agentType}] [{currentAgent.engine}] [{currentAgent.status}]
        </Text>
      </Box>

      {/* Output area with strict width constraints */}
      <Box
        paddingX={1}
        height={effectiveMaxLines}
        flexDirection="column"
        flexGrow={1}
        width="100%"
        overflow="hidden"
      >
        {isLoading ? (
          <Text dimColor>Waiting for agent output...</Text>
        ) : isConnecting ? (
          <Text>
            <Text color="white"><Spinner type="dots" /></Text> <ShimmerText text="Connecting to agent data" sweepSeconds={2.0} bandHalfWidth={2.5} />
          </Text>
        ) : error ? (
          <Text color="red">Error loading logs: {error}</Text>
        ) : sourceLines.length === 0 ? (
          <Text dimColor>Waiting for output...</Text>
        ) : (
          <Box
            flexDirection="column"
            width="100%"
            flexGrow={1}
            overflow="hidden"
          >
            {outputNodes}
          </Box>
        )}
      </Box>
    </Box>
  );
};
