import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { SubAgentState } from '../state/types';
import { getStatusIcon, getStatusColor } from '../utils/statusIcons';
import { formatDuration, formatTokens } from '../utils/formatters';
import { getVisibleItems } from '../utils/performance';

export interface SubAgentListProps {
  subAgents: SubAgentState[];
  selectedSubAgentId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Expanded list of sub-agents with selection support
 * Uses virtualization for lists > 10 items to improve performance
 */
export const SubAgentList: React.FC<SubAgentListProps> = ({
  subAgents,
  selectedSubAgentId,
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const MAX_VISIBLE = 10;

  // Auto-scroll to selected item
  useEffect(() => {
    if (selectedSubAgentId) {
      const selectedIndex = subAgents.findIndex((a) => a.id === selectedSubAgentId);
      if (selectedIndex >= 0) {
        // Ensure selected item is visible
        if (selectedIndex < scrollOffset) {
          setScrollOffset(selectedIndex);
        } else if (selectedIndex >= scrollOffset + MAX_VISIBLE) {
          setScrollOffset(selectedIndex - MAX_VISIBLE + 1);
        }
      }
    }
  }, [selectedSubAgentId, subAgents, scrollOffset]);

  if (subAgents.length === 0) {
    return null;
  }

  // Use virtualization for large lists
  const useVirtualization = subAgents.length > MAX_VISIBLE;
  const { visibleItems, startIndex, endIndex } = useVirtualization
    ? getVisibleItems(subAgents, scrollOffset, MAX_VISIBLE)
    : { visibleItems: subAgents, startIndex: 0, endIndex: subAgents.length };

  const remaining = subAgents.length - endIndex;

  return (
    <Box flexDirection="column" paddingLeft={3}>
      {startIndex > 0 && (
        <Box paddingLeft={2}>
          <Text dimColor>↑ {startIndex} more above</Text>
        </Box>
      )}

      {visibleItems.map((agent) => {
        const icon = getStatusIcon(agent.status);
        const color = getStatusColor(agent.status);
        const isSelected = agent.id === selectedSubAgentId;
        const prefix = isSelected ? '> ' : '  ';

        // Calculate duration
        let duration = '';
        if (agent.endTime) {
          const seconds = (agent.endTime - agent.startTime) / 1000;
          duration = formatDuration(seconds);
        } else if (agent.status === 'running') {
          const seconds = (Date.now() - agent.startTime) / 1000;
          duration = formatDuration(seconds);
        }

        // Telemetry
        const { tokensIn, tokensOut } = agent.telemetry;
        const tokenStr = tokensIn > 0 || tokensOut > 0 ? formatTokens(tokensIn, tokensOut) : '';

        return (
          <Box key={agent.id}>
            <Text>
              {prefix}
              <Text color={color}>{icon}</Text>
              {' '}
              {agent.name}
              {' '}
              <Text dimColor>({agent.engine})</Text>
              {duration && <Text> • {duration}</Text>}
              {tokenStr && <Text dimColor> • {tokenStr}</Text>}
              {agent.error && <Text color="red"> • Error: {agent.error}</Text>}
            </Text>
          </Box>
        );
      })}

      {remaining > 0 && (
        <Box paddingLeft={2}>
          <Text dimColor>↓ {remaining} more below</Text>
        </Box>
      )}
    </Box>
  );
};
