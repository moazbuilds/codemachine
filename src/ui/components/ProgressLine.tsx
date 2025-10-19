import React from 'react';
import { Box, Text } from 'ink';

export interface ProgressLineProps {
  currentStep: number;
  totalSteps: number;
  uniqueCompleted: number;
  totalExecuted: number;
  loopIteration?: number;
}

/**
 * Show workflow progress: current step, unique completed, total executed
 */
export const ProgressLine: React.FC<ProgressLineProps> = ({
  currentStep,
  totalSteps,
  uniqueCompleted,
  totalExecuted,
  loopIteration,
}) => {
  const iterationText = loopIteration ? ` (Iteration ${loopIteration})` : '';

  return (
    <Box paddingX={1}>
      <Text>
        Progress: Step {currentStep}/{totalSteps}{iterationText} • Completed: {uniqueCompleted} unique • Total executed: {totalExecuted}
      </Text>
    </Box>
  );
};
