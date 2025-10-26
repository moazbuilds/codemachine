import React, { useMemo, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import type { AgentState, SubAgentState, TriggeredAgentState, WorkflowState } from '../state/types';
import { MainAgentNode } from './MainAgentNode';
import { SubAgentSummary } from './SubAgentSummary';
import { TriggeredAgentList, MAX_TRIGGERED_AGENTS_DISPLAYED } from './TriggeredAgentList';
import { UIElementNode } from './UIElementNode';
import { isAgentSelected } from '../utils/agentSelection';
import { calculateAgentTimelineHeight } from '../utils/heightCalculations';
import { useTerminalResize } from '../hooks/useTerminalResize';
import { getTimelineLayout, type TimelineLayoutEntry } from '../utils/navigation';

export interface AgentTimelineProps {
  mainAgents: AgentState[];
  subAgents: Map<string, SubAgentState[]>;
  triggeredAgents: TriggeredAgentState[];
  uiElements: import('../state/types').UIElement[];
  selectedAgentId: string | null;
  expandedNodes: Set<string>;
  selectedSubAgentId: string | null;
  selectedItemType: 'main' | 'summary' | 'sub' | null;
  scrollOffset: number;
  onToggleExpand: (agentId: string) => void;
  onVisibleCountChange?: (count: number) => void;
  onScrollOffsetChange?: (offset: number, visibleCount: number) => void;
  availableHeight?: number;
}

const TIMELINE_HEADER_HEIGHT = 2; // Header text + padding
const MIN_VIEWPORT_HEIGHT = 1;

function getTriggeredListHeight(triggeredAgents: TriggeredAgentState[]): number {
  if (!triggeredAgents.length) {
    return 0;
  }

  const displayed = Math.min(triggeredAgents.length, MAX_TRIGGERED_AGENTS_DISPLAYED);
  const overflowLine = triggeredAgents.length > MAX_TRIGGERED_AGENTS_DISPLAYED ? 1 : 0;
  const marginTop = 1;
  const headerLine = 1;

  return marginTop + headerLine + displayed + overflowLine;
}

/**
 * Container for all agent displays (main, sub, triggered)
 * Displays main agents in a timeline with expandable sub-agents with smooth scrolling
 */
export const AgentTimeline: React.FC<AgentTimelineProps> = ({
  mainAgents,
  subAgents,
  triggeredAgents,
  uiElements,
  selectedAgentId,
  expandedNodes,
  selectedSubAgentId,
  selectedItemType,
  scrollOffset,
  onToggleExpand,
  onVisibleCountChange,
  onScrollOffsetChange,
  availableHeight,
}) => {
  const { stdout } = useStdout();
  useTerminalResize();

  const componentHeight = Math.max(
    TIMELINE_HEADER_HEIGHT + MIN_VIEWPORT_HEIGHT,
    availableHeight ?? calculateAgentTimelineHeight(stdout)
  );
  const triggeredListHeight = getTriggeredListHeight(triggeredAgents);
  const viewportHeight = Math.max(
    MIN_VIEWPORT_HEIGHT,
    componentHeight - TIMELINE_HEADER_HEIGHT - triggeredListHeight
  );

  useEffect(() => {
    onVisibleCountChange?.(viewportHeight);
  }, [viewportHeight, onVisibleCountChange]);

  const navigationState = useMemo<WorkflowState>(() => ({
    workflowName: '',
    version: '',
    packageName: '',
    startTime: 0,
    agents: mainAgents,
    subAgents,
    executionHistory: [],
    triggeredAgents,
    uiElements,
    loopState: null,
    checkpointState: null,
    expandedNodes,
    showTelemetryView: false,
    selectedAgentId,
    selectedSubAgentId,
    selectedItemType,
    visibleItemCount: viewportHeight,
    scrollOffset,
    totalSteps: 0,
    workflowStatus: 'running',
    agentIdMapVersion: 0,
  }), [
    mainAgents,
    subAgents,
    triggeredAgents,
    uiElements,
    expandedNodes,
    selectedAgentId,
    selectedSubAgentId,
    selectedItemType,
    scrollOffset,
    viewportHeight,
  ]);

  const layout = useMemo(() => getTimelineLayout(navigationState), [navigationState]);
  const totalLines = layout.length === 0 ? 0 : layout[layout.length - 1].offset + layout[layout.length - 1].height;
  const totalItems = layout.length;
  const maxOffset = Math.max(0, totalLines - viewportHeight);
  const clampedOffset = Math.max(0, Math.min(scrollOffset, maxOffset));

  useEffect(() => {
    if (onScrollOffsetChange && clampedOffset !== scrollOffset) {
      onScrollOffsetChange(clampedOffset, viewportHeight);
    }
  }, [clampedOffset, scrollOffset, viewportHeight, onScrollOffsetChange]);

  const visibleEntries = useMemo<TimelineLayoutEntry[]>(() => {
    if (layout.length === 0) {
      return [];
    }

    const entries: TimelineLayoutEntry[] = [];
    const viewportEnd = clampedOffset + viewportHeight;
    const startIndex = layout.findIndex((entry) => entry.offset + entry.height > clampedOffset);

    if (startIndex === -1) {
      return [];
    }

    for (let i = startIndex; i < layout.length; i++) {
      const entry = layout[i];

      // Stop if the next entry starts at or after the viewport end
      if (entry.offset >= viewportEnd) {
        break;
      }

      entries.push(entry);
    }

    return entries;
  }, [layout, clampedOffset, viewportHeight]);

  const timelineRows = useMemo(() => {
    return visibleEntries.map(({ item }, entryIndex) => {
      if (item.type === 'main') {
        const isMainSelected =
          selectedItemType === 'main' &&
          isAgentSelected(item.id, selectedAgentId, selectedSubAgentId);

        return (
          <Box key={`main-${item.id}-${entryIndex}`} flexDirection="column" overflow="hidden">
            <MainAgentNode agent={item.agent} isSelected={isMainSelected} />
          </Box>
        );
      }

      if (item.type === 'summary') {
        const parentSubAgents = subAgents.get(item.parentId) || [];
        if (parentSubAgents.length === 0) {
          return null;
        }
        const isExpanded = expandedNodes.has(item.parentId);
        const isSummarySelected =
          selectedItemType === 'summary' && selectedAgentId === item.id;

        return (
          <Box key={`summary-${item.id}-${entryIndex}`} flexDirection="column" overflow="hidden">
            <SubAgentSummary
              subAgents={parentSubAgents}
              isExpanded={isExpanded}
              isSelected={isSummarySelected}
              onToggle={() => onToggleExpand(item.parentId)}
            />
          </Box>
        );
      }

      if (item.type === 'ui') {
        return (
          <Box key={`ui-${item.id}-${entryIndex}`} flexDirection="column" overflow="hidden">
            <UIElementNode uiElement={item.uiElement} />
          </Box>
        );
      }

      const isSubSelected = selectedItemType === 'sub' && selectedSubAgentId === item.id;

      return (
        <Box key={`sub-${item.id}-${entryIndex}`} flexDirection="column" paddingLeft={2} overflow="hidden">
          <MainAgentNode agent={item.agent} isSelected={isSubSelected} />
        </Box>
      );
    });
  }, [
    visibleEntries,
    expandedNodes,
    selectedAgentId,
    selectedSubAgentId,
    selectedItemType,
    subAgents,
    onToggleExpand,
  ]);

  const renderedRows = useMemo(
    () => timelineRows.filter((node) => node !== null && node !== undefined) as React.ReactNode[],
    [timelineRows]
  );
  const hasVisibleRows = renderedRows.length > 0;
  const showRange = totalItems > 0 && (totalItems > viewportHeight || clampedOffset > 0);
  const rangeStart = totalItems === 0 ? 0 : clampedOffset + 1;
  const rangeEnd = totalItems === 0 ? 0 : Math.min(clampedOffset + viewportHeight, totalItems);
  const headerSuffix = showRange ? ` (${rangeStart}-${rangeEnd} of ${totalItems})` : '';

  return (
    <Box flexDirection="column" width="100%" height={componentHeight}>
      <Box paddingX={1} paddingBottom={1}>
        <Text bold underline>
          Workflow Pipeline{headerSuffix}
        </Text>
      </Box>

      <Box height={viewportHeight} flexDirection="column" overflow="hidden">
        {hasVisibleRows ? (
          renderedRows
        ) : (
          <Box paddingX={1}>
            <Text dimColor>No agents to display yet.</Text>
          </Box>
        )}
      </Box>

      {triggeredAgents.length > 0 && (
        <TriggeredAgentList triggeredAgents={triggeredAgents} />
      )}
    </Box>
  );
};
