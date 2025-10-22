import React, { useMemo } from 'react';
import { Box, Text, useStdout } from 'ink';
import type { AgentState, SubAgentState, TriggeredAgentState } from '../state/types';
import { MainAgentNode } from './MainAgentNode';
import { SubAgentSummary } from './SubAgentSummary';
import { SubAgentList } from './SubAgentList';
import { TriggeredAgentList } from './TriggeredAgentList';
import { isAgentSelected } from '../utils/agentSelection';
import { calculateAgentTimelineHeight } from '../utils/heightCalculations';
import { useTerminalResize } from '../hooks/useTerminalResize';

export interface AgentTimelineProps {
  mainAgents: AgentState[];
  subAgents: Map<string, SubAgentState[]>;
  triggeredAgents: TriggeredAgentState[];
  selectedAgentId: string | null;
  expandedNodes: Set<string>;
  selectedSubAgentId: string | null;
  selectedItemType: 'main' | 'summary' | 'sub' | null;
  onToggleExpand: (agentId: string) => void;
}

/**
 * Container for all agent displays (main, sub, triggered)
 * Displays main agents in a timeline with expandable sub-agents
 */
export const AgentTimeline: React.FC<AgentTimelineProps> = ({
  mainAgents,
  subAgents,
  triggeredAgents,
  selectedAgentId,
  expandedNodes,
  selectedSubAgentId,
  selectedItemType,
  onToggleExpand,
}) => {
  const { stdout } = useStdout();
  useTerminalResize();

  // Calculate available height dynamically using centralized utility
  // Recalculates when terminal size changes
  const availableHeight = calculateAgentTimelineHeight(stdout);

  // Build agent nodes
  const agentNodes = useMemo(() => {
    const nodes: React.ReactNode[] = [];

    mainAgents.forEach((agent, index) => {
      const isExpanded = expandedNodes.has(agent.id);
      const agentSubAgents = subAgents.get(agent.id) || [];
      const hasSubAgents = agentSubAgents.length > 0;

      // Only show arrow on main agent if selectedItemType is 'main'
      const isMainSelected = selectedItemType === 'main' &&
                             isAgentSelected(agent.id, selectedAgentId, selectedSubAgentId);

      nodes.push(
        <Box key={`${agent.id}-${index}`} flexDirection="column">
          <MainAgentNode
            agent={agent}
            isSelected={isMainSelected}
          />

          {hasSubAgents && (
            <>
              <SubAgentSummary
                subAgents={agentSubAgents}
                isExpanded={isExpanded}
                isSelected={selectedItemType === 'summary' && selectedAgentId === agent.id}
                onToggle={() => onToggleExpand(agent.id)}
              />

              {isExpanded && (
                <SubAgentList
                  subAgents={agentSubAgents}
                  selectedSubAgentId={selectedSubAgentId}
                />
              )}
            </>
          )}
        </Box>
      );
    });

    if (triggeredAgents.length > 0) {
      nodes.push(
        <TriggeredAgentList key="triggered" triggeredAgents={triggeredAgents} />
      );
    }

    return nodes;
  }, [
    mainAgents,
    subAgents,
    triggeredAgents,
    selectedAgentId,
    expandedNodes,
    selectedSubAgentId,
    selectedItemType,
    onToggleExpand,
  ]);

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* Header - Fixed height */}
      <Box paddingX={1} paddingBottom={1}>
        <Text bold underline>Main Workflow Steps</Text>
      </Box>

      {/* Agent list */}
      <Box height={availableHeight} flexDirection="column">
        {agentNodes}
      </Box>
    </Box>
  );
};
