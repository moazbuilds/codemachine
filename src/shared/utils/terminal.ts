/**
 * Comprehensive terminal clearing function
 * Clears both visible content and scrollback buffer
 */
export function clearTerminal(): void {
  // Clear visible content
  console.clear();

  // Try to clear scrollback buffer (supported by most modern terminals)
  // ANSI escape sequences
  process.stdout.write('\x1b[3J'); // Clear entire screen including scrollback
  process.stdout.write('\x1b[H');  // Move cursor to top
  process.stdout.write('\x1b[2J'); // Clear entire screen

  // Alternative approaches for different terminal types
  try {
    // For iTerm2 and some terminals
    process.stdout.write('\x1b]50;ClearScrollback\x07');

    // Add visual separation
    process.stdout.write('\n'.repeat(3));

    // Clear any remaining line
    process.stdout.write('\r\x1b[K');
  } catch {
    // If escape sequences don't work, fallback to newlines
    process.stdout.write('\n'.repeat(100));
  }

  // Final cursor positioning
  process.stdout.write('\x1b[H');
}