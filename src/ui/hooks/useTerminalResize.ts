import { useState, useEffect } from 'react';
import { useStdout } from 'ink';

/**
 * Hook to detect and respond to terminal size changes
 * Returns the current terminal dimensions and triggers re-renders on resize
 */
export function useTerminalResize() {
  const { stdout } = useStdout();
  const [terminalSize, setTerminalSize] = useState({
    rows: stdout?.rows || 40,
    columns: stdout?.columns || 80,
  });

  useEffect(() => {
    // Check for terminal size changes periodically
    const interval = setInterval(() => {
      const currentRows = stdout?.rows || 40;
      const currentColumns = stdout?.columns || 80;

      setTerminalSize(prev => {
        if (prev.rows !== currentRows || prev.columns !== currentColumns) {
          return { rows: currentRows, columns: currentColumns };
        }
        return prev;
      });
    }, 100); // Check every 100ms for responsive updates

    return () => clearInterval(interval);
  }, [stdout]);

  return terminalSize;
}