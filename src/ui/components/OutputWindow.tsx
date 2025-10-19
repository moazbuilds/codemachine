import React, { useMemo } from 'react';
import { Box, Text, useStdout } from 'ink';
import { ScrollBox } from '@sasaplus1/ink-scroll-box';
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
 * Uses ScrollBox for proper scrolling behavior
 */
export const OutputWindow: React.FC<OutputWindowProps> = ({
  currentAgent,
  outputLines,
  autoScroll,
  maxLines,
}) => {
  const { stdout } = useStdout();

  // Calculate available height dynamically
  // Header: 3, Progress: 2, Telemetry: 2, Footer: 2 = 9 lines
  // Window header: 2, footer: 1 = 3 lines
  const terminalHeight = stdout?.rows || 40;
  const availableHeight = Math.max(terminalHeight - 12, 10);
  const effectiveMaxLines = maxLines || availableHeight;

  if (!currentAgent) {
    return (
      <Box flexDirection="column" width="100%" height={effectiveMaxLines} justifyContent="center" alignItems="center">
        <Text dimColor>No agent selected</Text>
      </Box>
    );
  }

  const agentType = 'parentId' in currentAgent ? 'sub-agent' : 'main';

  // Calculate scroll offset for auto-scroll
  const scrollOffset = useMemo(() => {
    if (autoScroll && outputLines.length > effectiveMaxLines) {
      return outputLines.length - effectiveMaxLines;
    }
    return 0;
  }, [autoScroll, outputLines.length, effectiveMaxLines]);

  // Prepare output lines as React nodes
  const outputNodes = useMemo(() =>
    outputLines.map((line, index) => (
      <OutputLine key={index} line={line} />
    )),
    [outputLines]
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

      {/* Scrollable output area */}
      <Box paddingX={1} height={effectiveMaxLines}>
        {outputLines.length === 0 ? (
          <Text dimColor>Waiting for output...</Text>
        ) : (
          <ScrollBox offset={scrollOffset} initialHeight={effectiveMaxLines}>
            {outputNodes}
          </ScrollBox>
        )}
      </Box>

      {/* Footer - Show scroll info */}
      {outputLines.length > effectiveMaxLines && (
        <Box paddingX={1} paddingTop={1}>
          <Text dimColor>
            {autoScroll
              ? `Showing last ${effectiveMaxLines} of ${outputLines.length} lines (auto-scroll)`
              : `Showing first ${effectiveMaxLines} of ${outputLines.length} lines`
            }
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
