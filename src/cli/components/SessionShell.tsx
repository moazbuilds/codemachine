import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { SessionInput, type SlashCommand } from './SessionInput.js';

export interface SessionShellProps {
  onCommand: (command: string) => Promise<void> | void;
  onExit: () => void;
  projectName?: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { command: 'start', description: 'Run configured workflow queue' },
  { command: 'templates', description: 'List and select workflow templates' },
  { command: 'login', description: 'Authenticate with AI services' },
  { command: 'logout', description: 'Sign out of AI services' },
  { command: 'version', description: 'Show CLI version' },
  { command: 'help', description: 'Show this help' },
  { command: 'exit', description: 'Exit the session' },
];

export const SessionShell: React.FC<SessionShellProps> = ({
  onCommand,
  onExit,
  projectName,
}) => {
  const [messages, setMessages] = useState<Array<{ type: 'info' | 'error' | 'success'; text: string }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCommand = async (input: string) => {
    const trimmed = input.trim();

    if (!trimmed) {
      return;
    }

    // Clear previous messages
    setMessages([]);

    // Handle exit command specially
    if (trimmed === '/exit' || trimmed === '/quit') {
      onExit();
      return;
    }

    setIsProcessing(true);
    try {
      await onCommand(trimmed);
    } catch (error) {
      setMessages([{
        type: 'error',
        text: error instanceof Error ? error.message : String(error)
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          CodeMachine CLI
        </Text>
        {projectName && (
          <>
            <Text dimColor> • </Text>
            <Text color="white">{projectName}</Text>
          </>
        )}
      </Box>

      {/* Info banner */}
      <Box
        marginBottom={1}
        paddingX={2}
        paddingY={1}
        borderStyle="round"
        borderColor="gray"
        flexDirection="column"
      >
        <Text color="white">
          🚀 <Text bold>CodeMachine</Text> is an autonomous multi-agent platform
        </Text>
        <Text dimColor>
          Type <Text color="cyan">/start</Text> to begin or <Text color="cyan">/help</Text> for options
        </Text>
      </Box>

      {/* Messages */}
      {messages.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {messages.map((msg, index) => (
            <Box key={index}>
              <Text
                color={
                  msg.type === 'error' ? 'red' :
                  msg.type === 'success' ? 'green' :
                  'white'
                }
              >
                {msg.type === 'error' && '✗ '}
                {msg.type === 'success' && '✓ '}
                {msg.type === 'info' && 'ℹ '}
                {msg.text}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <Box marginBottom={1}>
          <Text dimColor>Processing...</Text>
        </Box>
      )}

      {/* Input */}
      {!isProcessing && (
        <SessionInput
          onSubmit={handleCommand}
          placeholder="Type /start to see the magic"
          slashCommands={SLASH_COMMANDS}
        />
      )}

      {/* Footer hint */}
      <Box marginTop={1}>
        <Text dimColor>
          Press Ctrl+C to exit at any time
        </Text>
      </Box>
    </Box>
  );
};
