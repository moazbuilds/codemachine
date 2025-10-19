import React from 'react';
import { Box, Text } from 'ink';
import type { AgentState, SubAgentState, TriggeredAgentState } from '../state/types';
import { MainAgentNode } from './MainAgentNode';
import { SubAgentSummary } from './SubAgentSummary';
import { SubAgentList } from './SubAgentList';
import { TriggeredAgentList } from './TriggeredAgentList';

export interface AgentTimelineProps {
  mainAgents: AgentState[];
  subAgents: Map<string, SubAgentState[]>;
  triggeredAgents: TriggeredAgentState[];
  selectedAgentId: string | null;
  expandedNodes: Set<string>;
  selectedSubAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onToggleExpand: (agentId: string) => void;
  onSelectSubAgent: (subAgentId: string) => void;
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
  onSelectAgent,
  onToggleExpand,
  onSelectSubAgent,
}) => {
  return (
    <Box flexDirection="column" width="100%">
      <Box paddingX={1} paddingBottom={1}>
        <Text bold underline>Main Workflow Steps</Text>
      </Box>

      {mainAgents.map((agent, index) => {
        const isSelected = agent.id === selectedAgentId;
        const isExpanded = expandedNodes.has(agent.id);
        const agentSubAgents = subAgents.get(agent.id) || [];
        const hasSubAgents = agentSubAgents.length > 0;

        return (
          <Box key={agent.id} flexDirection="column">
            <MainAgentNode
              agent={agent}
              index={index + 1}
              isSelected={isSelected}
              onSelect={() => onSelectAgent(agent.id)}
            />

            {hasSubAgents && (
              <>
                <SubAgentSummary
                  subAgents={agentSubAgents}
                  isExpanded={isExpanded}
                  onToggle={() => onToggleExpand(agent.id)}
                />

                {isExpanded && (
                  <SubAgentList
                    subAgents={agentSubAgents}
                    selectedSubAgentId={selectedSubAgentId}
                    onSelect={onSelectSubAgent}
                  />
                )}
              </>
            )}
          </Box>
        );
      })}

      {triggeredAgents.length > 0 && (
        <TriggeredAgentList triggeredAgents={triggeredAgents} />
      )}
    </Box>
  );
};
