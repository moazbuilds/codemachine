import React from 'react';
import { Box, Text } from 'ink';
import type { UIElement } from '../state/types';

export interface UIElementNodeProps {
  uiElement: UIElement;
}

/**
 * Display a UI element (static message) in the timeline
 * Shows text with decorative separators: ________ ❚❚ Text ______
 */
export const UIElementNode: React.FC<UIElementNodeProps> = ({ uiElement }) => {
  const separatorLength = 8;
  const separator = '_'.repeat(separatorLength);

  return (
    <Box paddingX={1}>
      <Text>
        <Text dimColor>{separator}</Text>
        {' '}
        <Text bold color="cyan">❚❚</Text>
        {' '}
        <Text bold color="yellow">{uiElement.text}</Text>
        {' '}
        <Text dimColor>{separator}</Text>
      </Text>
    </Box>
  );
};
