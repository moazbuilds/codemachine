import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { useRegistrySync } from '../hooks/useRegistrySync';
import type { AgentTreeNode } from '../../agents/monitoring/index.js';
import type { AgentRecord } from '../../agents/monitoring/types.js';
import { useCtrlCHandler } from '../hooks/useCtrlCHandler';
import { formatTokens, formatNumber } from '../utils/formatters';

export interface HistoryViewProps {
  onClose: () => void;
  onOpenLogViewer: (monitoringId: number) => void;
}

/**
 * Full-screen history view showing all agent executions from registry
 * Displays nested tree structure with box-drawing characters
 * Press Enter to open LogViewer for selected agent
 */
export const HistoryView: React.FC<HistoryViewProps> = ({ onClose, onOpenLogViewer }) => {
  const { tree: liveTree, isLoading } = useRegistrySync();

  // Track selection by index (simpler and more stable)
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pauseUpdates, setPauseUpdates] = useState(false);
  const lastInteractionTime = useRef<number>(Date.now());

  // Frozen snapshot of tree while navigating
  const [frozenTree, setFrozenTree] = useState<AgentTreeNode[]>([]);

  // Use frozen tree when paused, live tree when not paused
  const displayTree = pauseUpdates ? frozenTree : liveTree;

  // Flatten tree for navigation - memoized to prevent recalculation on every render
  const flattenedAgents = useMemo(() => flattenTree(displayTree), [displayTree]);

  // Update frozen tree when live tree changes and we're not paused
  useEffect(() => {
    if (!pauseUpdates) {
      setFrozenTree(liveTree);
    }
  }, [liveTree, pauseUpdates]);

  // Clamp selected index to valid range when data changes
  useEffect(() => {
    if (selectedIndex >= flattenedAgents.length && flattenedAgents.length > 0) {
      setSelectedIndex(flattenedAgents.length - 1);
    }
  }, [flattenedAgents.length, selectedIndex]);

  // Auto-resume updates after 2 seconds of no interaction
  useEffect(() => {
    if (pauseUpdates) {
      const timeout = setTimeout(() => {
        setPauseUpdates(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [pauseUpdates, lastInteractionTime.current]);

  useCtrlCHandler();

  // Keyboard handling
  useInput((input, key) => {
    if (input === 'h' || input === 'q' || key.escape) {
      onClose();
    } else if (key.upArrow) {
      lastInteractionTime.current = Date.now();

      // Freeze tree on first interaction
      if (!pauseUpdates) {
        setFrozenTree(liveTree);
        setPauseUpdates(true);
      }

      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      lastInteractionTime.current = Date.now();

      // Freeze tree on first interaction
      if (!pauseUpdates) {
        setFrozenTree(liveTree);
        setPauseUpdates(true);
      }

      setSelectedIndex((prev) => Math.min(flattenedAgents.length - 1, prev + 1));
    } else if (key.return) {
      // Open LogViewer for selected agent
      const selected = flattenedAgents[selectedIndex];
      if (selected) {
        onOpenLogViewer(selected.agent.id);
      }
    }
  });

  if (isLoading) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box paddingY={1} borderStyle="single" borderColor="cyan">
          <Text bold>🤖 CodeMachine • Execution History</Text>
        </Box>
        <Box justifyContent="center" alignItems="center" paddingY={2}>
          <Text>Loading history...</Text>
        </Box>
      </Box>
    );
  }

  if (flattenedAgents.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box paddingY={1} borderStyle="single" borderColor="cyan">
          <Text bold>🤖 CodeMachine • Execution History</Text>
        </Box>
        <Box justifyContent="center" alignItems="center" paddingY={2}>
          <Text dimColor>No execution history found</Text>
        </Box>
        <Box paddingY={1}>
          <Text dimColor>Press [H] to return to workflow view • [Q] to quit</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box paddingY={1} borderStyle="single" borderColor="cyan">
        <Text bold>🤖 CodeMachine • Execution History ({flattenedAgents.length} agents)</Text>
        {pauseUpdates && (
          <Text color="yellow" dimColor> • Updates paused</Text>
        )}
      </Box>

      <Box flexDirection="column" paddingY={1}>
        <Text bold underline>All Agent Executions (Nested)</Text>

        <Box paddingTop={1}>
          <Box width={40}>
            <Text bold>Agent</Text>
          </Box>
          <Box width={20}>
            <Text bold>Engine/Model</Text>
          </Box>
          <Box width={12}>
            <Text bold>Status</Text>
          </Box>
          <Box width={15}>
            <Text bold>Duration</Text>
          </Box>
          <Box width={25}>
            <Text bold>Tokens (in/out)</Text>
          </Box>
        </Box>

        {flattenedAgents.map((item, index) => (
          <AgentRow
            key={item.agent.id}
            item={item}
            isSelected={index === selectedIndex}
          />
        ))}
      </Box>

      <Box paddingY={1}>
        <Text dimColor>
          [H/Esc/Q] Close • [↑↓] Navigate • [Enter] Open logs
          {!pauseUpdates && <Text color="green"> • Live updates</Text>}
        </Text>
      </Box>
    </Box>
  );
};

/**
 * Flattened agent item with nesting metadata
 */
interface FlattenedAgent {
  agent: AgentRecord;
  depth: number;
  isLast: boolean;
  parentIsLast: boolean[];
}

/**
 * Flatten tree structure for rendering and navigation
 */
function flattenTree(tree: AgentTreeNode[]): FlattenedAgent[] {
  const result: FlattenedAgent[] = [];

  function traverse(nodes: AgentTreeNode[], depth: number, parentIsLast: boolean[]) {
    nodes.forEach((node, index) => {
      const isLast = index === nodes.length - 1;

      result.push({
        agent: node.agent,
        depth,
        isLast,
        parentIsLast,
      });

      if (node.children.length > 0) {
        traverse(node.children, depth + 1, [...parentIsLast, isLast]);
      }
    });
  }

  traverse(tree, 0, []);
  return result;
}

/**
 * Single row in the history tree
 */
const AgentRow: React.FC<{
  item: FlattenedAgent;
  isSelected: boolean;
}> = ({ item, isSelected }) => {
  const { agent, depth, isLast, parentIsLast } = item;

  // Build tree prefix with box-drawing characters
  let prefix = '';
  for (let i = 0; i < depth; i++) {
    if (i === depth - 1) {
      // Last level: use └─ or ├─
      prefix += isLast ? '└─ ' : '├─ ';
    } else {
      // Parent levels: use │ or space
      prefix += parentIsLast[i] ? '   ' : '│  ';
    }
  }

  // Status indicator
  const statusChar = agent.status === 'completed' ? '●' : agent.status === 'failed' ? '✗' : '○';
  const statusColor = agent.status === 'completed' ? 'green' : agent.status === 'failed' ? 'red' : 'yellow';

  // Calculate duration
  const duration = agent.duration
    ? formatDuration(agent.duration)
    : agent.status === 'running'
    ? 'Running...'
    : '-';

  // Format engine/model
  const engineModel = agent.engineProvider && agent.modelName
    ? `${agent.engineProvider}/${agent.modelName}`
    : agent.engineProvider || '-';

  // Truncate long names
  const displayName = prefix + agent.name;
  const truncatedName = displayName.length > 38 ? displayName.slice(0, 35) + '...' : displayName;

  // Telemetry
  const tokens = agent.telemetry
    ? formatTokens(agent.telemetry.tokensIn, agent.telemetry.tokensOut)
    : '-';

  return (
    <Box backgroundColor={isSelected ? 'blue' : undefined}>
      <Box width={40}>
        <Text>{truncatedName}</Text>
      </Box>
      <Box width={20}>
        <Text dimColor>{engineModel.length > 18 ? engineModel.slice(0, 15) + '...' : engineModel}</Text>
      </Box>
      <Box width={12}>
        <Text color={statusColor}>{statusChar} {agent.status}</Text>
      </Box>
      <Box width={15}>
        <Text>{duration}</Text>
      </Box>
      <Box width={25}>
        <Text dimColor>{tokens}</Text>
      </Box>
    </Box>
  );
};

/**
 * Format duration in milliseconds to readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
