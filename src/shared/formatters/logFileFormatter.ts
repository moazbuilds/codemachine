/**
 * Log file formatting utilities
 * Converts color markers to readable status text for log files
 */

// Status text mappings for log files
const STATUS_MAP = {
  '[GREEN]': '[SUCCESS]',
  '[RED]': '[ERROR]',
  '[ORANGE]': '[THINKING]',
  '[GRAY]': '[RUNNING]',
} as const;

/**
 * Format output for log files by replacing color markers with status text
 * Keeps the structure symbols (●, ⎿) for readability
 */
export function formatForLogFile(text: string): string {
  let result = text;

  // Replace color markers with status text
  for (const [colorMarker, statusText] of Object.entries(STATUS_MAP)) {
    result = result.replace(new RegExp(colorMarker.replace(/[[\]]/g, '\\$&'), 'g'), statusText);
  }

  // Strip bold markers (===) for log files
  result = result.replace(/^===/gm, '');

  return result;
}

/**
 * Strip all color markers from text (for plain text output)
 */
export function stripColorMarkers(text: string): string {
  let result = text;

  // Remove all color markers
  for (const colorMarker of Object.keys(STATUS_MAP)) {
    result = result.replace(new RegExp(colorMarker.replace(/[[\]]/g, '\\$&'), 'g'), '');
  }

  // Strip bold markers (===)
  result = result.replace(/^===/gm, '');

  return result;
}
