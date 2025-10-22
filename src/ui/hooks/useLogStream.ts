import { useState, useEffect } from 'react';
import { AgentMonitorService } from '../../agents/monitoring/monitor.js';
import type { AgentRecord } from '../../agents/monitoring/types.js';
import { readLogFile, getFileSize, watchLogFile } from '../utils/logReader';

export interface LogStreamResult {
  lines: string[];
  isLoading: boolean;
  error: string | null;
  logPath: string;
  fileSize: number;
  agentName: string;
  isRunning: boolean;
}

/**
 * Hook to stream log file contents with real-time updates for running agents
 * Uses 500ms polling for reliability across all filesystems
 */
export function useLogStream(monitoringAgentId: number | undefined): LogStreamResult {
  const [lines, setLines] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState(0);
  const [agent, setAgent] = useState<AgentRecord | null>(null);

  useEffect(() => {
    if (monitoringAgentId === undefined) {
      setError('Agent ID not provided');
      setIsLoading(false);
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
    async function getAgentWithRetry(attempts = 3, delay = 200): Promise<AgentRecord | null> {
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
     * Update log lines from file
     */
    async function updateLogs(logPath: string): Promise<void> {
      if (!mounted) return;

      try {
        const fileLines = await readLogFile(logPath);
        if (mounted) {
          setLines(fileLines);
          setFileSize(getFileSize(logPath));
        }
      } catch (err) {
        if (mounted) {
          setError(`Failed to read log: ${err}`);
        }
      }
    }

    /**
     * Initialize log streaming
     */
    async function initialize(): Promise<void> {
      const agentRecord = await getAgentWithRetry();

      if (!agentRecord) {
        if (mounted) {
          setError(`Agent ${agentId} not found in monitoring registry. It may not be registered yet.`);
          setIsLoading(false);
        }
        return;
      }

      if (!mounted) return;

      setAgent(agentRecord);
      setError(null);

      // Initial log read
      try {
        const fileLines = await readLogFile(agentRecord.logPath);
        if (mounted) {
          setLines(fileLines);
          setFileSize(getFileSize(agentRecord.logPath));
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(`Failed to read log: ${err}`);
          setIsLoading(false);
        }
        return;
      }

      // Set up real-time updates for running agents
      if (agentRecord.status === 'running') {
        // Primary: 500ms polling (reliable across all filesystems)
        pollInterval = setInterval(() => {
          updateLogs(agentRecord.logPath);
        }, 500);

        // Secondary: fs.watch for immediate updates (when available)
        try {
          fileWatcher = watchLogFile(agentRecord.logPath, (newLines) => {
            if (mounted) {
              setLines(newLines);
              setFileSize(getFileSize(agentRecord.logPath));
            }
          });
        } catch {
          // Ignore fs.watch errors - polling will handle updates
        }
      }
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
    error,
    logPath: agent?.logPath || '',
    fileSize,
    agentName: agent?.name || '',
    isRunning: agent?.status === 'running',
  };
}
