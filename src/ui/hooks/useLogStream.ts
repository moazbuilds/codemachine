import { useState, useEffect } from 'react';
import { AgentMonitorService } from '../../agents/monitoring/monitor.js';
import type { AgentRecord } from '../../agents/monitoring/types.js';
import { readLogFile, getFileSize } from '../utils/logReader';

export interface LogStreamResult {
  lines: string[];
  isLoading: boolean;
  isConnecting: boolean; // True when waiting for log file to be created
  error: string | null;
  logPath: string;
  fileSize: number;
  agentName: string;
  isRunning: boolean;
}

/**
 * Hook to stream log file contents with real-time updates for running agents
 * Uses 500ms polling for reliability across all filesystems
 * Automatically retries if log file doesn't exist yet (agent just started)
 */
export function useLogStream(monitoringAgentId: number | undefined): LogStreamResult {
  const [lines, setLines] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState(0);
  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [_retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (monitoringAgentId === undefined) {
      // Don't show error immediately - agent might not be registered yet
      // Just stay in loading state
      setIsLoading(true);
      setIsConnecting(false);
      setError(null);
      return;
    }

    const agentId = monitoringAgentId;

    let mounted = true;
    let pollInterval: NodeJS.Timeout | undefined;
    let fileWatcher: (() => void) | undefined;

    /**
     * Try to get agent from registry with retries
     * Handles timing issues when agent is newly synced
     */
    async function getAgentWithRetry(attempts = 5, delay = 300): Promise<AgentRecord | null> {
      const monitor = AgentMonitorService.getInstance();

      for (let i = 0; i < attempts; i++) {
        const agentRecord = monitor.getAgent(agentId);
        if (agentRecord) {
          return agentRecord;
        }

        // Wait before retry (except on last attempt)
        if (i < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      return null;
    }

    /**
     * Update log lines from file with retry logic for missing files
     */
    async function updateLogs(logPath: string, isInitialLoad = false, isRetrying = false): Promise<boolean> {
      if (!mounted) return false;

      try {
        const fileLines = await readLogFile(logPath);
        if (mounted) {
          setLines(fileLines);
          setFileSize(getFileSize(logPath));
          setIsConnecting(false);
          setRetryCount(0);
          setError(null); // Clear any previous errors
          return true;
        }
      } catch (err) {
        if (mounted) {
          // During initial load or retrying, don't show errors - just track state
          if (isInitialLoad || isRetrying) {
            if (err instanceof Error && err.message.includes('not found')) {
              setIsConnecting(true);
              setError(null); // Don't show error while connecting/retrying
              return false;
            }
          }

          // Only show errors if we're not in retry mode
          // This will be set by the retry exhaustion logic
          if (!isRetrying) {
            setError(`Failed to read log: ${err}`);
            setIsConnecting(false);
          }
          return false;
        }
      }
      return false;
    }

    /**
     * Initialize log streaming with retry logic
     */
    async function initialize(): Promise<void> {
      const agentRecord = await getAgentWithRetry();

      if (!agentRecord) {
        if (mounted) {
          // Agent not found after retries - this is a real error
          setError(`Agent not found in monitoring registry after 1.5 seconds.`);
          setIsLoading(false);
          setIsConnecting(false);
        }
        return;
      }

      if (!mounted) return;

      setAgent(agentRecord);
      setError(null);

      // Initial log read with retry for missing files
      const success = await updateLogs(agentRecord.logPath, true);

      if (mounted) {
        setIsLoading(false);
      }

      // If file doesn't exist yet, set up retry polling (every 500ms, max 240 tries = 120 seconds)
      if (!success && mounted) {
        const MAX_RETRIES = 240;
        let currentRetry = 0;

        const retryInterval = setInterval(async () => {
          if (!mounted) {
            clearInterval(retryInterval);
            return;
          }

          currentRetry++;

          // Stop retrying after max attempts
          if (currentRetry >= MAX_RETRIES) {
            clearInterval(retryInterval);
            setIsConnecting(false);
            setError("Can't connect to agent after 120 sec");
            setRetryCount(currentRetry);
            return;
          }

          setRetryCount(currentRetry);

          // Pass isRetrying=true to suppress errors during retry attempts
          const retrySuccess = await updateLogs(agentRecord.logPath, false, true);

          if (retrySuccess) {
            clearInterval(retryInterval);
            // After successful connection, start normal polling if agent is running
            if (agentRecord.status === 'running' && mounted) {
              startPolling(agentRecord.logPath);
            }
          }
        }, 500);

        // Store interval for cleanup
        pollInterval = retryInterval;
        return;
      }

      // Set up real-time updates for running agents (if file exists)
      if (success && agentRecord.status === 'running') {
        startPolling(agentRecord.logPath);
      }
    }

    /**
     * Start polling for log updates
     */
    function startPolling(logPath: string): void {
      // Clear any existing interval
      if (pollInterval) {
        clearInterval(pollInterval);
      }

      // 1000ms polling with random offset to prevent thundering herd
      // Stagger polls across agents to avoid simultaneous file I/O
      const pollDelay = 1000 + Math.random() * 200;
      pollInterval = setInterval(() => {
        updateLogs(logPath);
      }, pollDelay);
    }

    initialize();

    // Cleanup function
    return () => {
      mounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (fileWatcher) {
        fileWatcher();
      }
    };
  }, [monitoringAgentId]);

  return {
    lines,
    isLoading,
    isConnecting,
    error,
    logPath: agent?.logPath || '',
    fileSize,
    agentName: agent?.name || '',
    isRunning: agent?.status === 'running',
  };
}
