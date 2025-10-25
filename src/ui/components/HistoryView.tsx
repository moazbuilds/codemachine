import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { useRegistrySync } from '../hooks/useRegistrySync';
import type { AgentTreeNode } from '../../agents/monitoring/index.js';
import type { AgentRecord } from '../../agents/monitoring/types.js';
import { useCtrlCHandler } from '../hooks/useCtrlCHandler';
import { formatTokens } from '../utils/formatters';

export interface HistoryViewProps {
  onClose: () => void;
  onOpenLogViewer: (monitoringId: number) => void;
  // Scroll position restoration
  savedScrollOffset?: number;
  savedSelectedIndex?: number;
  onScrollStateChange?: (scrollOffset: number, selectedIndex: number) => void;
}

/**
 * Full-screen history view showing all agent executions from registry
 * Displays nested tree structure with box-drawing characters
 * Press Enter to open LogViewer for selected agent
 */
export const HistoryView: React.FC<HistoryViewProps> = ({
  onClose,
  onOpenLogViewer,
  savedScrollOffset,
  savedSelectedIndex,
  onScrollStateChange,
}) => {
  const { tree: liveTree, isLoading } = useRegistrySync();
  const { stdout } = useStdout();

  // Track selection by index (simpler and more stable)
  // Restore from saved position if available
  const [selectedIndex, setSelectedIndex] = useState(savedSelectedIndex ?? 0);
  const [scrollOffset, setScrollOffset] = useState(savedScrollOffset ?? 0);
  const [pauseUpdates, setPauseUpdates] = useState(false);
  const lastInteractionTime = useRef<number>(Date.now());

  // Frozen snapshot of tree while navigating
  const [frozenTree, setFrozenTree] = useState<AgentTreeNode[]>([]);

  // Use frozen tree when paused, live tree when not paused
  const displayTree = pauseUpdates ? frozenTree : liveTree;

  // Flatten tree for navigation - memoized to prevent recalculation on every render
  const flattenedAgents = useMemo(() => flattenTree(displayTree), [displayTree]);

  // Calculate visible lines (terminal height - header - column headers - footer - scroll indicator)
  const terminalHeight = stdout?.rows || 40;
  const visibleLines = Math.max(5, terminalHeight - 8); // Reserve space for UI elements

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

  // Auto-scroll to keep selected item visible in viewport
  useEffect(() => {
    // If selected item is above viewport, scroll up
    if (selectedIndex < scrollOffset) {
      setScrollOffset(selectedIndex);
    }
    // If selected item is below viewport, scroll down
    else if (selectedIndex >= scrollOffset + visibleLines) {
      setScrollOffset(selectedIndex - visibleLines + 1);
    }
  }, [selectedIndex, scrollOffset, visibleLines]);

  // Auto-resume updates after 2 seconds of no interaction
  useEffect(() => {
    if (pauseUpdates) {
      const timeout = setTimeout(() => {
        setPauseUpdates(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [pauseUpdates, lastInteractionTime.current]);

  // Get visible agents based on viewport
  const visibleAgents = useMemo(() => {
    return flattenedAgents.slice(scrollOffset, scrollOffset + visibleLines);
  }, [flattenedAgents, scrollOffset, visibleLines]);

  useCtrlCHandler();

  // Keyboard handling
  useInput((input, key) => {
    if (input === 'h' || key.escape) {
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
    } else if (key.pageUp) {
      lastInteractionTime.current = Date.now();

      if (!pauseUpdates) {
        setFrozenTree(liveTree);
        setPauseUpdates(true);
      }

      setSelectedIndex((prev) => Math.max(0, prev - visibleLines));
    } else if (key.pageDown) {
      lastInteractionTime.current = Date.now();

      if (!pauseUpdates) {
        setFrozenTree(liveTree);
        setPauseUpdates(true);
      }

      setSelectedIndex((prev) => Math.min(flattenedAgents.length - 1, prev + visibleLines));
    } else if (input === 'g') {
      // Go to top (vim-style)
      lastInteractionTime.current = Date.now();

      if (!pauseUpdates) {
        setFrozenTree(liveTree);
        setPauseUpdates(true);
      }

      setSelectedIndex(0);
    } else if (input === 'G') {
      // Go to bottom (vim-style)
      lastInteractionTime.current = Date.now();

      if (!pauseUpdates) {
        setFrozenTree(liveTree);
        setPauseUpdates(true);
      }

      setSelectedIndex(flattenedAgents.length - 1);
    } else if (key.return) {
      // Save scroll state before opening log viewer
      if (onScrollStateChange) {
        onScrollStateChange(scrollOffset, selectedIndex);
      }

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
        <Box justifyContent="center" alignItems="center" paddingY={2}>
          <Text>Loading history...</Text>
        </Box>
      </Box>
    );
  }

  if (flattenedAgents.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box justifyContent="center" alignItems="center" paddingY={2}>
          <Text dimColor>No execution history found</Text>
        </Box>
        <Box paddingY={1}>
          <Text dimColor>[H/Esc] Close</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Column Headers */}
      <Box paddingTop={1}>
        <Box width={6}>
          <Text bold>ID</Text>
        </Box>
        <Box width={30}>
          <Text bold>Agent</Text>
        </Box>
        <Box width={28}>
          <Text bold>Engine/Model</Text>
        </Box>
        <Box width={12}>
          <Text bold>Status</Text>
        </Box>
        <Box width={12}>
          <Text bold>Duration</Text>
        </Box>
        <Box width={22}>
          <Text bold>Tokens (in/out)</Text>
        </Box>
      </Box>

      {/* Agent Rows */}
      {visibleAgents.map((item, index) => {
        const absoluteIndex = scrollOffset + index;
        return (
          <AgentRow
            key={item.agent.id}
            item={item}
            isSelected={absoluteIndex === selectedIndex}
          />
        );
      })}

      {/* Footer */}
      {flattenedAgents.length > 0 && (
        <Box paddingY={1}>
          <Text dimColor>
            Showing {scrollOffset + 1}-{Math.min(scrollOffset + visibleLines, flattenedAgents.length)} of {flattenedAgents.length}
            {!pauseUpdates && <Text color="green"> • Live</Text>}
            {pauseUpdates && <Text color="yellow"> • Paused</Text>}
          </Text>
        </Box>
      )}

      <Box paddingY={1}>
        <Text dimColor>
          [H/Esc] Close • [↑↓] Navigate • [g/G] Top/Bottom • [Enter] Open logs
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
  const statusChar = agent.status === 'completed' ? '●' : agent.status === 'failed' ? '●' : '○';
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
  const truncatedName = displayName.length > 28 ? displayName.slice(0, 25) + '...' : displayName;

  // Telemetry
  const tokens = agent.telemetry
    ? formatTokens(agent.telemetry.tokensIn, agent.telemetry.tokensOut)
    : '-';

  return (
    <Box backgroundColor={isSelected ? 'blue' : undefined}>
      <Box width={6}>
        <Text color="cyan">{agent.id}</Text>
      </Box>
      <Box width={30}>
        <Text>{truncatedName}</Text>
      </Box>
      <Box width={28}>
        <Text dimColor>{engineModel.length > 26 ? engineModel.slice(0, 23) + '...' : engineModel}</Text>
      </Box>
      <Box width={12}>
        <Text color={statusColor}>{statusChar} {agent.status}</Text>
      </Box>
      <Box width={12}>
        <Text>{duration}</Text>
      </Box>
      <Box width={22}>
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
