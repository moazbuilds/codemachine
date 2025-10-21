import type { Stdout } from 'ink';

/**
 * UI Component Heights (in terminal lines)
 */
export const UI_COMPONENT_HEIGHTS = {
  BRANDING_HEADER: 3,        // ASCII art header
  TELEMETRY_BAR: 2,         // Telemetry bar with border and padding
  STATUS_FOOTER: 1,         // Status footer line
  OUTPUT_WINDOW_HEADER: 2,  // Output window internal header
  BORDERS_AND_PADDING: 2,   // Total borders and padding throughout UI
  MINIMUM_HEIGHT: 10,       // Minimum usable height for UI
} as const;

/**
 * Calculate available height for main content area
 * Accounts for all fixed UI elements
 */
export function calculateMainContentHeight(stdout: Stdout | null): number {
  const terminalHeight = stdout?.rows || 40;

  const fixedElementsHeight =
    UI_COMPONENT_HEIGHTS.BRANDING_HEADER +
    UI_COMPONENT_HEIGHTS.TELEMETRY_BAR +
    UI_COMPONENT_HEIGHTS.STATUS_FOOTER;

  const availableHeight = terminalHeight - fixedElementsHeight;
  return Math.max(availableHeight, UI_COMPONENT_HEIGHTS.MINIMUM_HEIGHT);
}

/**
 * Calculate available height for OutputWindow component
 * Accounts for OutputWindow's internal header and borders
 */
export function calculateOutputWindowHeight(stdout: Stdout | null): number {
  const mainContentHeight = calculateMainContentHeight(stdout);

  const outputWindowOverhead =
    UI_COMPONENT_HEIGHTS.OUTPUT_WINDOW_HEADER +
    UI_COMPONENT_HEIGHTS.BORDERS_AND_PADDING;

  const availableHeight = mainContentHeight - outputWindowOverhead;
  return Math.max(availableHeight, 5); // Minimum 5 lines for output content
}

/**
 * Calculate available height for AgentTimeline component
 * AgentTimeline shares the same row as OutputWindow, so it uses the same main content height
 */
export function calculateAgentTimelineHeight(stdout: Stdout | null): number {
  const mainContentHeight = calculateMainContentHeight(stdout);

  const timelineOverhead = UI_COMPONENT_HEIGHTS.BORDERS_AND_PADDING;
  const availableHeight = mainContentHeight - timelineOverhead;

  return Math.max(availableHeight, 5); // Minimum 5 lines for timeline content
}

/**
 * Check if terminal is too small for proper UI display
 */
export function isTerminalTooSmall(stdout: Stdout | null): boolean {
  const terminalHeight = stdout?.rows || 40;
  return terminalHeight < 15; // Minimum recommended height
}

/**
 * Get terminal size information for debugging
 */
export function getTerminalInfo(stdout: Stdout | null) {
  return {
    rows: stdout?.rows || 40,
    columns: stdout?.columns || 80,
    isTooSmall: isTerminalTooSmall(stdout),
    mainContentHeight: calculateMainContentHeight(stdout),
    outputWindowHeight: calculateOutputWindowHeight(stdout),
    agentTimelineHeight: calculateAgentTimelineHeight(stdout),
  };
}