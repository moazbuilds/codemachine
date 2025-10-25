import React, { useState, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { ShimmerText } from './ShimmerText';
import { wrapText } from '../utils/heightCalculations';

export interface CheckpointModalProps {
  reason?: string;
  onContinue: () => void;
  onQuit: () => void;
}

/**
 * Checkpoint modal that pauses workflow for manual review
 * Full-screen terminal page that replaces the main view with shimmer effects
 */
export const CheckpointModal: React.FC<CheckpointModalProps> = ({
  reason,
  onContinue,
  onQuit,
}) => {
  const { stdout } = useStdout();
  const [selectedButton, setSelectedButton] = useState<'continue' | 'quit'>('continue');

  useInput((input, key) => {
    // Arrow key navigation
    if (key.leftArrow || key.rightArrow) {
      setSelectedButton((prev) => (prev === 'continue' ? 'quit' : 'continue'));
    }
    // Enter key to confirm
    else if (key.return) {
      if (selectedButton === 'continue') {
        onContinue();
      } else {
        onQuit();
      }
    }
    // Direct keyboard shortcuts
    else if (input === 'c' || input === 'C') {
      onContinue();
    } else if (input === 'q' || input === 'Q') {
      onQuit();
    }
  });

  // Calculate modal width based on terminal size
  // Leave 8 characters for padding (4 on each side), max 80 chars
  const terminalWidth = stdout?.columns || 80;
  const modalWidth = Math.min(terminalWidth - 8, 80);

  const borderLine = '═'.repeat(modalWidth);
  const separatorLine = '─'.repeat(modalWidth);

  // Wrap text content to fit modal width
  const wrappedReason = useMemo(
    () => wrapText(reason || 'Checkpoint triggered - please review workflow state', modalWidth),
    [reason, modalWidth]
  );

  const wrappedInfo = useMemo(
    () => wrapText('Workflow paused — make your changes, then press Continue to resume the session.', modalWidth),
    [modalWidth]
  );

  return (
    <Box flexDirection="column" padding={2}>
      {/* Shimmer Top Border */}
      <Box>
        <ShimmerText text={borderLine} sweepSeconds={3} bandHalfWidth={8} />
      </Box>

      {/* Title */}
      <Box marginTop={1}>
        <Text bold color="orange">⏸  </Text>
        <Text bold color="cyan">CHECKPOINT - Review Required</Text>
      </Box>

      {/* Reason/Instructions */}
      <Box marginTop={1} flexDirection="column">
        {wrappedReason.map((line, idx) => (
          <Text key={idx} color="yellow">
            {line}
          </Text>
        ))}
      </Box>

      {/* Info */}
      <Box marginTop={1} flexDirection="column">
        {wrappedInfo.map((line, idx) => (
          <Text key={idx} color="white">
            {line}
          </Text>
        ))}
      </Box>

      {/* Separator */}
      <Box marginTop={1}>
        <Text color="cyan">{separatorLine}</Text>
      </Box>

      {/* Buttons */}
      <Box marginTop={1} gap={4}>
        <Text
          backgroundColor={selectedButton === 'continue' ? 'green' : undefined}
          color={selectedButton === 'continue' ? 'black' : 'green'}
          bold
        >
          {selectedButton === 'continue' ? '► ' : '  '}[C]ontinue
        </Text>
        <Text
          backgroundColor={selectedButton === 'quit' ? 'red' : undefined}
          color={selectedButton === 'quit' ? 'black' : 'red'}
        >
          {selectedButton === 'quit' ? '► ' : '  '}[Q]uit
        </Text>
      </Box>

      {/* Instructions */}
      <Box marginTop={1}>
        <Text dimColor>
          [←→] Navigate  [ENTER] Confirm  [C/Q] Direct
        </Text>
      </Box>

      {/* Shimmer Bottom Border */}
      <Box marginTop={1}>
        <ShimmerText text={borderLine} sweepSeconds={3} bandHalfWidth={8} />
      </Box>
    </Box>
  );
};
