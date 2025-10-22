import React from 'react';
import { Text } from 'ink';

export interface LineSyntaxHighlightProps {
  line: string;
}

/**
 * Apply consistent syntax highlighting to workflow output/log lines.
 */
export const LineSyntaxHighlight: React.FC<LineSyntaxHighlightProps> = ({ line }) => {
  if (line.includes('🔧 TOOL')) {
    return <Text color="cyan">{line}</Text>;
  }

  if (line.includes('🧠 THINKING')) {
    return <Text color="magenta">{line}</Text>;
  }

  if (line.includes('💬 TEXT') || line.includes('💬 MESSAGE')) {
    return <Text>{line}</Text>;
  }

  if (line.includes('⏱️') || line.includes('Tokens:')) {
    return <Text color="yellow">{line}</Text>;
  }

  if (line.includes('ERROR') || line.includes('✗') || line.includes('Error:')) {
    return <Text color="red">{line}</Text>;
  }

  if (line.includes('✅') || line.includes('✓')) {
    return <Text color="green">{line}</Text>;
  }

  if (line.startsWith('===')) {
    return <Text bold>{line}</Text>;
  }

  return <Text>{line}</Text>;
};
