import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface SelectChoice<T = string> {
  title: string;
  value: T;
  description?: string;
}

export interface SelectMenuProps<T = string> {
  message: string;
  choices: SelectChoice<T>[];
  onSelect: (value: T) => void;
  onCancel?: () => void;
}

export function SelectMenu<T = string>({
  message,
  choices,
  onSelect,
  onCancel,
}: SelectMenuProps<T>): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(choices.length - 1, prev + 1));
    } else if (key.return) {
      onSelect(choices[selectedIndex].value);
    } else if (key.escape || (key.ctrl && input === 'c')) {
      onCancel?.();
    } else if (input >= '1' && input <= '9') {
      const num = parseInt(input, 10);
      if (num >= 1 && num <= choices.length) {
        onSelect(choices[num - 1].value);
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan">◆</Text>
        <Text> {message}</Text>
      </Box>

      {choices.map((choice, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Box key={index} marginLeft={1}>
            <Text color={isSelected ? 'cyan' : 'white'}>
              {isSelected ? '●' : '○'}
            </Text>
            <Text> </Text>
            <Text color={isSelected ? 'cyan' : 'white'}>
              {choice.title}
            </Text>
            {choice.description && (
              <>
                <Text dimColor> (</Text>
                <Text dimColor>{choice.description}</Text>
                <Text dimColor>)</Text>
              </>
            )}
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text dimColor>Use ↑/↓ arrow keys, Enter to select, Esc to cancel</Text>
      </Box>
    </Box>
  );
}
