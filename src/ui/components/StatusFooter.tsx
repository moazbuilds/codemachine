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
        Keys: [S]kip [Q]uit [↑↓]Scroll [ENTER]Open [T]elemetry Detail
      </Text>
    </Box>
  );
};
