import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { WorkflowState } from '../state/types';
import { BrandingHeader } from './BrandingHeader';
import { AgentTimeline } from './AgentTimeline';
import { OutputWindow } from './OutputWindow';
import { TelemetryBar } from './TelemetryBar';
import { HistoryView } from './HistoryView';
import { StatusFooter } from './StatusFooter';
import { LogViewer } from './LogViewer';
import { formatRuntime } from '../utils/formatters';
import { getOutputAgent } from '../utils/agentSelection';
import { useCtrlCHandler } from '../hooks/useCtrlCHandler';
import { calculateMainContentHeight } from '../utils/heightCalculations';

export interface WorkflowDashboardProps {
  state: WorkflowState;
  onAction: (action: UIAction) => void;
  getMonitoringId: (uiId: string) => number | undefined;
}

export type UIAction =
  | { type: 'SKIP' }
  | { type: 'QUIT' }
  | { type: 'TOGGLE_EXPAND'; agentId: string }
  | { type: 'TOGGLE_TELEMETRY' }
  | { type: 'SELECT_AGENT'; agentId: string }
  | { type: 'SELECT_SUB_AGENT'; subAgentId: string }
  | { type: 'NAVIGATE_UP'; visibleItemCount?: number }
  | { type: 'NAVIGATE_DOWN'; visibleItemCount?: number }
  | { type: 'SET_VISIBLE_COUNT'; count: number }
  | { type: 'SET_SCROLL_OFFSET'; offset: number; visibleItemCount?: number }
  | { type: 'SELECT_ITEM'; itemId: string; itemType: 'main' | 'summary' | 'sub' };

/**
 * Main container component for workflow UI
 * Handles keyboard events and layout orchestration
 */
export const WorkflowDashboard: React.FC<WorkflowDashboardProps> = ({
  state,
  onAction,
  getMonitoringId,
}) => {
  const { stdout } = useStdout();
  const [showHistory, setShowHistory] = useState(false);
  const [runtime, setRuntime] = useState('00:00:00');
  const [logViewerAgentId, setLogViewerAgentId] = useState<string | null>(null);
  const [historyLogViewerMonitoringId, setHistoryLogViewerMonitoringId] = useState<number | null>(null);

  useCtrlCHandler();

  // Update runtime every second (or freeze if endTime is set)
  useEffect(() => {
    const interval = setInterval(() => {
      setRuntime(formatRuntime(state.startTime, state.endTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [state.startTime, state.endTime]);

  // Keyboard event handling
  useInput((input, key) => {
    if (input === 's') {
      onAction({ type: 'SKIP' });
    } else if (input === 'h') {
      setShowHistory(!showHistory);
      onAction({ type: 'TOGGLE_TELEMETRY' });
    } else if (key.upArrow) {
      onAction({ type: 'NAVIGATE_UP', visibleItemCount: state.visibleItemCount });
    } else if (key.downArrow) {
      onAction({ type: 'NAVIGATE_DOWN', visibleItemCount: state.visibleItemCount });
    } else if (key.return && state.selectedItemType === 'summary' && state.selectedAgentId) {
      // Enter key toggles expansion only when summary is selected
      onAction({ type: 'TOGGLE_EXPAND', agentId: state.selectedAgentId });
    } else if (key.ctrl && input === 'l') {
      // Ctrl+L opens log viewer for selected agent
      const agentId = state.selectedSubAgentId || state.selectedAgentId;
      if (agentId) {
        setLogViewerAgentId(agentId);
      }
    }
  });

  // Get current agent for output window using centralized logic
  const currentAgent = getOutputAgent(state);

  // Calculate cumulative telemetry from execution history
  // This persists across loop resets and includes all cycles
  const totalTokensIn = state.executionHistory.reduce((sum, record) => sum + record.telemetry.tokensIn, 0);
  const totalTokensOut = state.executionHistory.reduce((sum, record) => sum + record.telemetry.tokensOut, 0);
  const totalCached = state.executionHistory.reduce((sum, record) => sum + (record.telemetry.cached || 0), 0);
  const totalCost = state.executionHistory.reduce((sum, record) => sum + (record.telemetry.cost || 0), 0);

  // Also include current running agents (not yet in history)
  let runningTokensIn = state.agents.reduce((sum, a) => sum + a.telemetry.tokensIn, 0);
  let runningTokensOut = state.agents.reduce((sum, a) => sum + a.telemetry.tokensOut, 0);
  let runningCached = state.agents.reduce((sum, a) => sum + (a.telemetry.cached || 0), 0);
  let runningCost = state.agents.reduce((sum, a) => sum + (a.telemetry.cost || 0), 0);

  // Include current subagents (not yet in history)
  for (const subAgents of state.subAgents.values()) {
    for (const subAgent of subAgents) {
      runningTokensIn += subAgent.telemetry.tokensIn;
      runningTokensOut += subAgent.telemetry.tokensOut;
      runningCached += subAgent.telemetry.cached || 0;
      runningCost += subAgent.telemetry.cost || 0;
    }
  }

  const cumulativeStats = {
    totalTokensIn: totalTokensIn + runningTokensIn,
    totalTokensOut: totalTokensOut + runningTokensOut,
    totalCached: totalCached + runningCached,
    totalCost: totalCost + runningCost,
    loopIterations: state.loopState?.iteration,
  };

  // Calculate constrained height for main content area
  const mainContentHeight = calculateMainContentHeight(stdout);

  // Calculate dynamic panel widths based on terminal size
  // Use 35% for agents panel, 65% for output panel
  // Ensure total width never exceeds terminal width
  const terminalWidth = stdout?.columns || 120;
  let leftPanelWidth = Math.floor(terminalWidth * 0.35);
  // Apply minimum but ensure we don't exceed terminal width
  leftPanelWidth = Math.min(Math.max(30, leftPanelWidth), terminalWidth - 40);
  const rightPanelWidth = terminalWidth - leftPanelWidth;

  // Log viewer from history view (highest priority)
  if (historyLogViewerMonitoringId !== null) {
    return (
      <LogViewer
        uiAgentId={historyLogViewerMonitoringId.toString()}
        onClose={() => setHistoryLogViewerMonitoringId(null)}
        getMonitoringId={() => historyLogViewerMonitoringId}
      />
    );
  }

  // Log viewer from workflow view
  if (logViewerAgentId) {
    return (
      <LogViewer
        uiAgentId={logViewerAgentId}
        onClose={() => setLogViewerAgentId(null)}
        getMonitoringId={getMonitoringId}
      />
    );
  }

  // History view (execution history from registry)
  if (showHistory) {
    return (
      <HistoryView
        onClose={() => setShowHistory(false)}
        onOpenLogViewer={(monitoringId) => setHistoryLogViewerMonitoringId(monitoringId)}
      />
    );
  }

  // Main workflow view
  return (
    <Box flexDirection="column" height="100%" gap={0}>
      <BrandingHeader
        version={state.version}
        currentDir={process.cwd()}
      />

      {/* Main content area with explicit height constraint */}
      <Box
        height={mainContentHeight}
        flexDirection="row"
        paddingTop={0}
      >
        {/* Workflow Steps - Dynamic width */}
        <Box width={leftPanelWidth} flexDirection="column">
          <Text color="cyan">{'─'.repeat(leftPanelWidth)}</Text>
          <AgentTimeline
            mainAgents={state.agents}
            subAgents={state.subAgents}
            triggeredAgents={state.triggeredAgents}
            selectedAgentId={state.selectedAgentId}
            expandedNodes={state.expandedNodes}
            selectedSubAgentId={state.selectedSubAgentId}
            selectedItemType={state.selectedItemType}
            scrollOffset={state.scrollOffset}
            onToggleExpand={(agentId) => onAction({ type: 'TOGGLE_EXPAND', agentId })}
            onVisibleCountChange={(count) => onAction({ type: 'SET_VISIBLE_COUNT', count })}
            onScrollOffsetChange={(offset, count) =>
              onAction({ type: 'SET_SCROLL_OFFSET', offset, visibleItemCount: count })
            }
          />
          <Text color="cyan">{'─'.repeat(leftPanelWidth)}</Text>
        </Box>

        {/* Agent Output - Takes remaining space with constrained height */}
        <Box flexGrow={1} flexDirection="column">
          <Text color="cyan">{'─'.repeat(rightPanelWidth)}</Text>
          <OutputWindow
            currentAgent={currentAgent}
            getMonitoringId={getMonitoringId}
          />
          <Text color="cyan">{'─'.repeat(rightPanelWidth)}</Text>
        </Box>
      </Box>

      <TelemetryBar
        workflowName={state.workflowName}
        runtime={runtime}
        status={state.workflowStatus}
        total={{
          tokensIn: cumulativeStats.totalTokensIn,
          tokensOut: cumulativeStats.totalTokensOut,
          cached: cumulativeStats.totalCached,
        }}
      />

      <StatusFooter />
    </Box>
  );
};
