import React from 'react';
import { Box, Text } from 'ink';
import type { UIElement } from '../state/types';

export interface UIElementNodeProps {
  uiElement: UIElement;
}

/**
 * Display a UI element (static message) in the timeline
 * Shows text with subtle gray separators: ──── Text ────
 */
export const UIElementNode: React.FC<UIElementNodeProps> = ({ uiElement }) => {
  const separatorLength = 4;
  const separator = '─'.repeat(separatorLength);

  return (
    <Box paddingX={1}>
      <Text dimColor>
        {separator} {uiElement.text} {separator}
      </Text>
    </Box>
  );
};
