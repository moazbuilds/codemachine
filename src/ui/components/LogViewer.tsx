import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { useLogStream } from '../hooks/useLogStream';
import { formatBytes } from '../utils/logReader';

export interface LogViewerProps {
  uiAgentId: string;
  onClose: () => void;
  getMonitoringId: (uiId: string) => number | undefined;
}

/**
 * Full-screen log viewer with scrolling support
 * Shows complete log file with real-time updates for running agents
 */
export const LogViewer: React.FC<LogViewerProps> = ({
  uiAgentId,
  onClose,
  getMonitoringId,
}) => {
  const monitoringId = getMonitoringId(uiAgentId);
  const { lines, isLoading, error, logPath, fileSize, agentName, isRunning } =
    useLogStream(monitoringId);

  const [scrollOffset, setScrollOffset] = useState(0);
  const { stdout } = useStdout();

  // Calculate visible lines (terminal height - header - footer)
  const terminalHeight = stdout?.rows || 40;
  const visibleLines = terminalHeight - 6; // Reserve 6 lines for header/footer

  // Auto-scroll to bottom for running agents when new content arrives
  useEffect(() => {
    if (isRunning && lines.length > 0) {
      const maxOffset = Math.max(0, lines.length - visibleLines);
      setScrollOffset(maxOffset);
    }
  }, [lines.length, isRunning, visibleLines]);

  // Keyboard handling
  useInput((input, key) => {
    if ((key.ctrl && input === 'l') || input === 'q' || key.escape) {
      onClose();
    } else if (key.upArrow) {
      setScrollOffset((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setScrollOffset((prev) => Math.min(Math.max(0, lines.length - visibleLines), prev + 1));
    } else if (key.pageUp) {
      setScrollOffset((prev) => Math.max(0, prev - visibleLines));
    } else if (key.pageDown) {
      setScrollOffset((prev) =>
        Math.min(Math.max(0, lines.length - visibleLines), prev + visibleLines)
      );
    }
  });

  // Get visible lines based on scroll offset
  const displayLines = useMemo(() => {
    if (lines.length === 0) return [];
    return lines.slice(scrollOffset, scrollOffset + visibleLines);
  }, [lines, scrollOffset, visibleLines]);

  // Calculate scroll position info
  const totalLines = lines.length;
  const startLine = scrollOffset + 1;
  const endLine = Math.min(scrollOffset + displayLines.length, totalLines);
  const scrollPercentage =
    totalLines > visibleLines
      ? Math.round((scrollOffset / (totalLines - visibleLines)) * 100)
      : 100;

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text bold>
          Full Logs: {agentName} {isRunning && <Text color="yellow">(Running)</Text>}
        </Text>
      </Box>

      <Box paddingX={1} paddingY={0}>
        <Text dimColor>
          Path: {logPath} • Size: {formatBytes(fileSize)}
        </Text>
      </Box>

      {/* Content */}
      <Box flexGrow={1} flexDirection="column" paddingX={1} paddingTop={1}>
        {isLoading ? (
          <Box justifyContent="center" alignItems="center" height="100%">
            <Text>Loading logs...</Text>
          </Box>
        ) : error ? (
          <Box justifyContent="center" alignItems="center" height="100%">
            <Text color="red">Error: {error}</Text>
          </Box>
        ) : totalLines === 0 ? (
          <Box justifyContent="center" alignItems="center" height="100%">
            <Text dimColor>Log file is empty</Text>
          </Box>
        ) : (
          <Box flexDirection="column">
            {displayLines.map((line, idx) => (
              <LogLine key={scrollOffset + idx} line={line} lineNumber={scrollOffset + idx + 1} />
            ))}
          </Box>
        )}
      </Box>

      {/* Scroll position indicator */}
      {!isLoading && !error && totalLines > 0 && (
        <Box paddingX={1}>
          <Text dimColor>
            Lines {startLine}-{endLine} of {totalLines} ({scrollPercentage}%)
            {isRunning && <Text color="yellow"> • Live updates enabled</Text>}
          </Text>
        </Box>
      )}

      {/* Footer */}
      <Box paddingX={1} paddingY={0}>
        <Text dimColor>
          [Ctrl+L/Esc/Q] Close  [↑↓] Scroll  [PgUp/PgDn] Page
        </Text>
      </Box>
    </Box>
  );
};

/**
 * Single log line with syntax highlighting
 * Reuses the same highlighting logic as OutputWindow
 */
const LogLine: React.FC<{ line: string; lineNumber: number }> = ({ line }) => {
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
  if (line.includes('ERROR') || line.includes('✗') || line.includes('Error:')) {
    return <Text color="red">{line}</Text>;
  }
  if (line.includes('✅') || line.includes('✓')) {
    return <Text color="green">{line}</Text>;
  }
  if (line.startsWith('===')) {
    return <Text bold>{line}</Text>;
  }

  // Default
  return <Text>{line}</Text>;
};
