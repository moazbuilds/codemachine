/**
 * UI Component Heights (in terminal lines)
 */
export const UI_COMPONENT_HEIGHTS = {
  BRANDING_HEADER: 3,        // ASCII art header
  TELEMETRY_BAR: 3,         // Telemetry bar with border + extra spacing
  STATUS_FOOTER: 2,         // Status footer line + spacing
  OUTPUT_WINDOW_HEADER: 1,  // Header line only (no padding)
  BORDERS_AND_PADDING: 2,   // Additional buffer for header/footer visibility
  MINIMUM_HEIGHT: 8,        // Reduced minimum for smaller boxes
} as const;

/**
 * Calculate available height for main content area
 * Accounts for all fixed UI elements with extra buffer to ensure header/footer visibility
 */
export function calculateMainContentHeight(stdout: NodeJS.WriteStream | null): number {
  const terminalHeight = stdout?.rows || 40;

  const fixedElementsHeight =
    UI_COMPONENT_HEIGHTS.BRANDING_HEADER +
    UI_COMPONENT_HEIGHTS.TELEMETRY_BAR +
    UI_COMPONENT_HEIGHTS.STATUS_FOOTER +
    UI_COMPONENT_HEIGHTS.BORDERS_AND_PADDING;

  // No additional buffer - all reserved in calculations
  const totalReservedHeight = fixedElementsHeight;

  const availableHeight = terminalHeight - totalReservedHeight;
  return Math.max(availableHeight, UI_COMPONENT_HEIGHTS.MINIMUM_HEIGHT);
}

/**
 * Calculate available height for OutputWindow component
 * Accounts for OutputWindow's internal header and minimal borders
 */
export function calculateOutputWindowHeight(stdout: NodeJS.WriteStream | null): number {
  const mainContentHeight = calculateMainContentHeight(stdout);

  const outputWindowOverhead =
    UI_COMPONENT_HEIGHTS.OUTPUT_WINDOW_HEADER;

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
  const timelineOverhead = UI_COMPONENT_HEIGHTS.OUTPUT_WINDOW_HEADER;
  const availableHeight = mainContentHeight - timelineOverhead;

  return Math.max(availableHeight, 4); // Reduced minimum for smaller boxes
}

/**
 * Check if terminal is too small for proper UI display
 */
export function isTerminalTooSmall(stdout: NodeJS.WriteStream | null): boolean {
  const terminalHeight = stdout?.rows || 40;
  return terminalHeight < 15; // Minimum recommended height
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
  };
}