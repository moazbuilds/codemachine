import React from 'react';
import { Box, Text } from 'ink';

export interface StatusFooterProps {
  currentView: 'workflow' | 'telemetry';
}

/**
 * Show keyboard shortcuts at bottom of screen
 */
export const StatusFooter: React.FC<StatusFooterProps> = ({ currentView }) => {
  if (currentView === 'telemetry') {
    return (
      <Box paddingX={1}>
        <Text dimColor>Press [T] to return to workflow view • [Q] to quit • [↑↓] to scroll</Text>
      </Box>
    );
  }

  return (
    <Box paddingX={1}>
      <Text dimColor>
        [↑↓] Navigate  [ENTER] Expand/Collapse  [Ctrl+L] Full Logs  [T] Telemetry  [S] Skip  [Q] Quit
      </Text>
    </Box>
  );
};
