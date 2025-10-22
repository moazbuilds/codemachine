import type { AgentStatus } from '../state/types';
import { formatDuration } from './formatters';

export interface DurationInput {
  startTime: number;
  endTime?: number;
  status: AgentStatus;
}

export interface DurationOptions {
  fallback?: string;
  nowProvider?: () => number;
}

/**
 * Calculate display-friendly duration for an agent based on timestamps/status.
 */
export const calculateDuration = (
  { startTime, endTime, status }: DurationInput,
  options?: DurationOptions
): string => {
  const { fallback = '', nowProvider = Date.now } = options ?? {};

  if (endTime) {
    return formatDuration((endTime - startTime) / 1000);
  }

  if (status === 'running') {
    return formatDuration((nowProvider() - startTime) / 1000);
  }

  return fallback;
};
