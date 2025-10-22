import React from 'react';
import { Box, Text } from 'ink';

/**
 * Show keyboard shortcuts at bottom of screen
 */
export const StatusFooter: React.FC = () => (
  <Box paddingX={1}>
    <Text dimColor>
      [↑↓] Navigate  [ENTER] Expand/View Logs  [H] History  [Ctrl+S] Skip  [Ctrl+C] Exit
    </Text>
  </Box>
);
