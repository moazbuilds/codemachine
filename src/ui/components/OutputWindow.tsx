import React from 'react';
import { Box, Text } from 'ink';
import type { AgentState, SubAgentState } from '../state/types';

export interface OutputWindowProps {
  currentAgent: AgentState | SubAgentState | null;
  outputLines: string[];
  autoScroll: boolean;
  maxLines?: number;
}

/**
 * Scrollable output window showing current agent's output
 * Displays last N lines with syntax highlighting
 */
export const OutputWindow: React.FC<OutputWindowProps> = ({
  currentAgent,
  outputLines,
  autoScroll,
  maxLines = 20,
}) => {
  if (!currentAgent) {
    return (
      <Box flexDirection="column" width="100%" height={maxLines} justifyContent="center" alignItems="center">
        <Text dimColor>No agent selected</Text>
      </Box>
    );
  }

  // Get last N lines for display
  const displayLines = autoScroll
    ? outputLines.slice(-maxLines)
    : outputLines.slice(0, maxLines);

  const agentType = 'parentId' in currentAgent ? 'sub-agent' : 'main';

  return (
    <Box flexDirection="column" width="100%">
      <Box paddingX={1} paddingBottom={1} justifyContent="space-between">
        <Text bold underline>
          Output: {currentAgent.name}
        </Text>
        <Text dimColor>
          [{agentType}] [{currentAgent.engine}] [{currentAgent.status}]
        </Text>
      </Box>

      <Box flexDirection="column" paddingX={1}>
        {displayLines.length === 0 ? (
          <Text dimColor>Waiting for output...</Text>
        ) : (
          displayLines.map((line, index) => (
            <OutputLine key={index} line={line} />
          ))
        )}
      </Box>

      {autoScroll && outputLines.length > maxLines && (
        <Box paddingX={1} paddingTop={1}>
          <Text dimColor>
            Showing last {maxLines} of {outputLines.length} lines (auto-scroll enabled)
          </Text>
        </Box>
      )}
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
