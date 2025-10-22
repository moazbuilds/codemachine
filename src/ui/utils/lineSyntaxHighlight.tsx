import React from 'react';
import { Text, useStdout } from 'ink';
import { wrapText, calculateOutputWindowContentWidth } from './heightCalculations';

export interface LineSyntaxHighlightProps {
  line: string;
  maxWidth?: number;
  wrap?: boolean;
}

/**
 * Apply consistent syntax highlighting to workflow output/log lines.
 * Supports text wrapping and truncation to prevent container width overflow.
 */
export const LineSyntaxHighlight: React.FC<LineSyntaxHighlightProps> = ({
  line,
  maxWidth,
  wrap = true
}) => {
  const { stdout } = useStdout();

  // Calculate available width if not provided
  const availableWidth = maxWidth || calculateOutputWindowContentWidth(stdout);

  // Determine text color based on content
  const getTextColor = (text: string) => {
    if (text.includes('🔧 TOOL')) return 'cyan';
    if (text.includes('🧠 THINKING')) return 'magenta';
    if (text.includes('⏱️') || text.includes('Tokens:')) return 'yellow';
    if (text.includes('ERROR') || text.includes('✗') || text.includes('Error:')) return 'red';
    if (text.includes('✅') || text.includes('✓')) return 'green';
    return undefined;
  };

  const getBold = (text: string) => {
    return text.startsWith('===');
  };

  // For short lines, just apply syntax highlighting
  const color = getTextColor(line);
  const bold = getBold(line);

  return <Text color={color} bold={bold}>{line}</Text>;
};
