import React from 'react';
import { Box, Text } from 'ink';
import type { LoopState } from '../state/types';

export interface LoopIndicatorProps {
  loopState: LoopState | null;
}

/**
 * Display loop state when workflow is looping back
 */
export const LoopIndicator: React.FC<LoopIndicatorProps> = ({ loopState }) => {
  if (!loopState || !loopState.active) {
    return null;
  }

  const skipText = loopState.skipList.length > 0
    ? ` • Skipping: ${loopState.skipList.join(', ')}`
    : '';

  return (
    <Box paddingX={1}>
      <Text color="yellow">
        🔄 Loop: {loopState.sourceAgent} → Back {loopState.backSteps} steps • Iteration {loopState.iteration}/{loopState.maxIterations}{skipText}
      </Text>
    </Box>
  );
};
