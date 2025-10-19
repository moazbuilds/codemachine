import React from 'react';
import { Box, Text } from 'ink';

export interface StatusFooterProps {
  currentView: 'workflow' | 'telemetry';
  paused?: boolean;
}

/**
 * Show keyboard shortcuts at bottom of screen
 */
export const StatusFooter: React.FC<StatusFooterProps> = ({ currentView, paused }) => {
  const pausedText = paused ? ' • PAUSED' : '';

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
        Keys: [P]ause [S]kip [Q]uit [↑↓]Scroll [ENTER]Open [Space]Collapse [T]elemetry Detail{pausedText}
      </Text>
    </Box>
  );
};
