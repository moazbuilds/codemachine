import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

export interface SlashCommand {
  command: string;
  description: string;
}

export interface SessionInputProps {
  onSubmit: (input: string) => void;
  placeholder?: string;
  slashCommands: SlashCommand[];
}

export const SessionInput: React.FC<SessionInputProps> = ({
  onSubmit,
  placeholder = 'Type /start to see the magic',
  slashCommands,
}) => {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (input.startsWith('/')) {
      const query = input.slice(1).toLowerCase();
      const matches = slashCommands.filter(cmd =>
        cmd.command.toLowerCase().startsWith(query)
      );
      setFilteredCommands(matches);
      setShowSuggestions(matches.length > 0);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
      setFilteredCommands([]);
    }
  }, [input, slashCommands]);

  // Handle arrow keys for suggestion navigation
  useInput((input, key) => {
    if (!showSuggestions || filteredCommands.length === 0) {
      return;
    }

    if (key.upArrow) {
      // Move selection up
      setSelectedIndex(prev =>
        prev > 0 ? prev - 1 : filteredCommands.length - 1
      );
    } else if (key.downArrow) {
      // Move selection down
      setSelectedIndex(prev =>
        prev < filteredCommands.length - 1 ? prev + 1 : 0
      );
    }
  });

  const handleSubmit = (value: string) => {
    // If suggestions are showing, execute the selected suggestion
    if (showSuggestions && filteredCommands.length > 0) {
      const selected = filteredCommands[selectedIndex];
      const selectedCommand = `/${selected.command}`;

      onSubmit(selectedCommand);
      setInput('');
      setShowSuggestions(false);
      return;
    }

    // Otherwise, submit what's typed
    if (value.trim()) {
      onSubmit(value);
      setInput('');
      setShowSuggestions(false);
    }
  };

  const handleChange = (value: string) => {
    setInput(value);
  };

  // Calculate visible window for scrolling suggestions
  const maxVisibleItems = 5;
  const getVisibleCommands = () => {
    if (filteredCommands.length <= maxVisibleItems) {
      return { commands: filteredCommands, startIndex: 0 };
    }

    // Calculate scroll position to keep selected item in view
    let startIndex = Math.max(0, selectedIndex - Math.floor(maxVisibleItems / 2));
    const endIndex = startIndex + maxVisibleItems;

    // Adjust if we're near the end
    if (endIndex > filteredCommands.length) {
      startIndex = Math.max(0, filteredCommands.length - maxVisibleItems);
    }

    return {
      commands: filteredCommands.slice(startIndex, startIndex + maxVisibleItems),
      startIndex
    };
  };

  const { commands: visibleCommands, startIndex: visibleStartIndex } = getVisibleCommands();

  return (
    <Box flexDirection="column" width="100%">
      {/* Input box */}
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        width="100%"
      >
        <Box marginRight={1}>
          <Text color="cyan" bold>CODEMACHINE</Text>
          <Text dimColor> › </Text>
        </Box>
        <Box flexGrow={1}>
          <TextInput
            value={input}
            onChange={handleChange}
            onSubmit={handleSubmit}
            placeholder={placeholder}
            showCursor={true}
          />
        </Box>
      </Box>

      {/* Autocomplete suggestions */}
      {showSuggestions && filteredCommands.length > 0 && (
        <Box
          flexDirection="column"
          marginTop={1}
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
          paddingY={0}
        >
          <Box marginBottom={0}>
            <Text dimColor>
              ↑↓ navigate • Enter to execute {filteredCommands.length > maxVisibleItems && `(${selectedIndex + 1}/${filteredCommands.length})`}
            </Text>
          </Box>
          {visibleCommands.map((cmd, index) => {
            const actualIndex = visibleStartIndex + index;
            return (
              <Box key={cmd.command} marginLeft={1}>
                <Text color={actualIndex === selectedIndex ? 'green' : 'gray'}>
                  {actualIndex === selectedIndex ? '› ' : '  '}
                </Text>
                <Text color={actualIndex === selectedIndex ? 'cyan' : 'white'}>
                  /{cmd.command}
                </Text>
                <Text dimColor> - {cmd.description}</Text>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
