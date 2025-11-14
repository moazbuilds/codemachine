import { useCallback } from 'react';
import { useInput, type Key } from 'ink';
import { MonitoringCleanup } from '../../agents/monitoring/index.js';

const defaultCtrlCHandler = () => {
  MonitoringCleanup.triggerCtrlCFromUI().catch((error) => {
    console.error('Failed to handle Ctrl+C via MonitoringCleanup, falling back to SIGINT:', error);
    process.kill(process.pid, 'SIGINT');
  });
};

export interface UseCtrlCHandlerOptions {
  onCtrlC?: () => void;
  enabled?: boolean;
}

/**
 * Centralized handler for two-stage Ctrl+C behavior across Ink components.
 * By default it routes Ctrl+C presses through MonitoringCleanup's staged flow.
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
