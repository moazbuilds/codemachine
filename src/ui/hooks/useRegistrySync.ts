import { useState, useEffect, useRef } from 'react';
import { AgentMonitorService, type AgentTreeNode } from '../../agents/monitoring/index.js';

/**
 * Hook to sync with agent registry in real-time
 * Polls the registry every 500ms to get latest agent tree structure
 * Only triggers re-render when data actually changes
 */
export function useRegistrySync() {
  const [tree, setTree] = useState<AgentTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const lastTreeJson = useRef<string>('');

  useEffect(() => {
    const monitor = AgentMonitorService.getInstance();

    // Initial load
    const loadTree = () => {
      try {
        const agentTree = monitor.buildAgentTree();

        // Only update state if tree actually changed (deep comparison via JSON)
        const currentTreeJson = JSON.stringify(agentTree);
        if (currentTreeJson !== lastTreeJson.current) {
          lastTreeJson.current = currentTreeJson;
          setTree(agentTree);
        }

        setIsLoading(false);
      } catch (_error) {
        // Silent fail - registry might not be initialized yet
        const emptyJson = JSON.stringify([]);
        if (lastTreeJson.current !== emptyJson) {
          lastTreeJson.current = emptyJson;
          setTree([]);
        }
        setIsLoading(false);
      }
    };

    loadTree();

    // Poll every 500ms for live updates
    const interval = setInterval(() => {
      loadTree();
    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return { tree, isLoading };
}
