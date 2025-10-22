import React from 'react';
import { Box, Text } from 'ink';

/**
 * Show keyboard shortcuts at bottom of screen
 */
export const StatusFooter: React.FC = () => (
  <Box paddingX={1}>
    <Text dimColor>
      [↑↓] Navigate  [ENTER] Expand/Collapse  [Ctrl+L] Full Logs  [T] Telemetry  [S] Skip  [Ctrl+C] Exit
    </Text>
  </Box>
);
