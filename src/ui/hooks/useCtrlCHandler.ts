import { useCallback } from 'react';
import { useInput, type Key } from 'ink';

const defaultCtrlCHandler = () => {
  process.kill(process.pid, 'SIGINT');
};

export interface UseCtrlCHandlerOptions {
  onCtrlC?: () => void;
  enabled?: boolean;
}

/**
 * Centralized handler for two-stage Ctrl+C behavior across Ink components
 * Sends SIGINT to the current process by default, while allowing overrides.
 */
export function useCtrlCHandler(options?: UseCtrlCHandlerOptions): void {
  const { onCtrlC = defaultCtrlCHandler, enabled = true } = options ?? {};

  const handler = useCallback(
    (input: string, key: Key) => {
      if ((key.ctrl && input === 'c') || input === '\x03') {
        onCtrlC();
      }
    },
    [onCtrlC]
  );

  useInput(handler, { isActive: enabled });
}
