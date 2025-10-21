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
 */
export function useLogStream(monitoringAgentId: number | undefined): LogStreamResult {
  const [lines, setLines] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState(0);
  const [agent, setAgent] = useState<AgentRecord | null>(null);

  useEffect(() => {
    if (monitoringAgentId === undefined) {
      setError('Agent not found');
      setIsLoading(false);
      return;
    }

    const monitor = AgentMonitorService.getInstance();
    const agentRecord = monitor.getAgent(monitoringAgentId);

    if (!agentRecord) {
      setError('Agent record not found in monitoring registry');
      setIsLoading(false);
      return;
    }

    setAgent(agentRecord);

    // Read log file
    readLogFile(agentRecord.logPath)
      .then((fileLines) => {
        setLines(fileLines);
        setFileSize(getFileSize(agentRecord.logPath));
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });

    // Watch for updates if agent is running
    if (agentRecord.status === 'running') {
      const unwatch = watchLogFile(agentRecord.logPath, (newLines) => {
        setLines(newLines);
        setFileSize(getFileSize(agentRecord.logPath));
      });

      return unwatch; // Cleanup function
    }
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
