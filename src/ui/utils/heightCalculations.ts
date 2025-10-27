import { parseMarker } from '../../shared/formatters/outputMarkers.js';

/**
 * UI Component Dimensions (in terminal lines/columns)
 */
export const UI_COMPONENT_DIMENSIONS = {
  // Heights
  BRANDING_HEADER: 3,        // ASCII art header
  TELEMETRY_BAR: 3,         // Telemetry bar with border + extra spacing
  STATUS_FOOTER: 2,         // Status footer line + spacing
  OUTPUT_WINDOW_HEADER: 1,  // Header line only (no padding)
  BORDERS_AND_PADDING: 2,   // Additional buffer for header/footer visibility
  MINIMUM_HEIGHT: 8,        // Reduced minimum for smaller boxes

  // Widths
  HORIZONTAL_PADDING: 2,    // Left and right padding (1 character each)
  BORDER_WIDTH: 2,          // Left and right borders (1 character each)
  MINIMUM_WIDTH: 20,        // Minimum usable width for content
  MAX_LINE_LENGTH: 1000,    // Maximum line length before truncation
} as const;

/**
 * Calculate available height for main content area
 * Accounts for all fixed UI elements with extra buffer to ensure header/footer visibility
 */
export function calculateMainContentHeight(stdout: NodeJS.WriteStream | null): number {
  const terminalHeight = stdout?.rows || 40;

  const fixedElementsHeight =
    UI_COMPONENT_DIMENSIONS.BRANDING_HEADER +
    UI_COMPONENT_DIMENSIONS.TELEMETRY_BAR +
    UI_COMPONENT_DIMENSIONS.STATUS_FOOTER +
    UI_COMPONENT_DIMENSIONS.BORDERS_AND_PADDING;

  // No additional buffer - all reserved in calculations
  const totalReservedHeight = fixedElementsHeight;

  const availableHeight = terminalHeight - totalReservedHeight;
  return Math.max(availableHeight, UI_COMPONENT_DIMENSIONS.MINIMUM_HEIGHT);
}

/**
 * Calculate available height for OutputWindow component
 * Accounts for OutputWindow's internal header and minimal borders
 */
export function calculateOutputWindowHeight(stdout: NodeJS.WriteStream | null): number {
  const mainContentHeight = calculateMainContentHeight(stdout);

  const outputWindowOverhead =
    UI_COMPONENT_DIMENSIONS.OUTPUT_WINDOW_HEADER;

  const availableHeight = mainContentHeight - outputWindowOverhead;
  return Math.max(availableHeight, 4); // Reduced minimum for smaller boxes
}

/**
 * Calculate available height for AgentTimeline component
 * AgentTimeline shares the same row as OutputWindow, so it uses the same main content height
 */
export function calculateAgentTimelineHeight(stdout: NodeJS.WriteStream | null): number {
  const mainContentHeight = calculateMainContentHeight(stdout);

  // Minimal overhead for header only
  const timelineOverhead = UI_COMPONENT_DIMENSIONS.OUTPUT_WINDOW_HEADER;
  const availableHeight = mainContentHeight - timelineOverhead;

  return Math.max(availableHeight, 4); // Reduced minimum for smaller boxes
}

/**
 * Calculate available width for text content in OutputWindow
 * Accounts for padding, borders, and layout constraints to ensure text fits within container
 */
export function calculateOutputWindowContentWidth(stdout: NodeJS.WriteStream | null): number {
  const terminalWidth = stdout?.columns || 80;

  // Account for AgentTimeline fixed width (75 chars) + borders (2 chars) + main content area borders
  const agentTimelineWidth = 75; // Fixed width from WorkflowDashboard
  const agentTimelineBorders = 2; // Single border style
  const outputWindowBorders = 2; // Single border style around OutputWindow
  const horizontalPadding = UI_COMPONENT_DIMENSIONS.HORIZONTAL_PADDING;

  const availableWidth = terminalWidth -
    agentTimelineWidth -
    agentTimelineBorders -
    outputWindowBorders -
    horizontalPadding;

  return Math.max(availableWidth, UI_COMPONENT_DIMENSIONS.MINIMUM_WIDTH);
}

/**
 * Wrap text to fit within specified width with optional truncation
 * @param text - The text to wrap
 * @param maxWidth - Maximum width for each line
 * @param maxLines - Maximum number of lines before truncation (optional)
 * @returns Array of wrapped and potentially truncated lines
 */
export function wrapText(text: string, maxWidth: number, maxLines?: number): string[] {
  if (maxWidth <= 0 || !text) return [''];

  const { color, text: stripped } = parseMarker(text);
  const markerPrefix = color ? `[${color.toUpperCase()}]` : '';
  const content = stripped;

  const lines: string[] = [];
  const words = content.split(' ');
  let currentLine = '';

  for (const word of words) {
    // If word itself is longer than maxWidth, truncate it
    if (word.length > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      lines.push(word.substring(0, maxWidth));
      continue;
    }

    // Check if adding this word would exceed maxWidth
    if (currentLine && (currentLine.length + 1 + word.length) > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  const applyMarker = (line: string) => (markerPrefix ? `${markerPrefix}${line}` : line);

  // Apply maxLines truncation if specified
  if (maxLines && lines.length > maxLines) {
    const truncated = lines.slice(0, maxLines - 1);
    const lastLine = lines[maxLines - 1];
    if (lastLine.length >= maxWidth - 3) {
      truncated.push(lastLine.substring(0, maxWidth - 3) + '...');
    } else {
      truncated.push(lastLine + '...');
    }
    return truncated.map(applyMarker);
  }

  return lines.map(applyMarker);
}

/**
 * Check if terminal is too small for proper UI display
 */
export function isTerminalTooSmall(stdout: NodeJS.WriteStream | null): boolean {
  const terminalHeight = stdout?.rows || 40;
  const terminalWidth = stdout?.columns || 80;
  return terminalHeight < 15 || terminalWidth < 40; // Minimum recommended dimensions
}

/**
 * Get terminal size information for debugging
 */
export function getTerminalInfo(stdout: NodeJS.WriteStream | null) {
  return {
    rows: stdout?.rows || 40,
    columns: stdout?.columns || 80,
    isTooSmall: isTerminalTooSmall(stdout),
    mainContentHeight: calculateMainContentHeight(stdout),
    outputWindowHeight: calculateOutputWindowHeight(stdout),
    agentTimelineHeight: calculateAgentTimelineHeight(stdout),
    outputWindowContentWidth: calculateOutputWindowContentWidth(stdout),
  };
}
