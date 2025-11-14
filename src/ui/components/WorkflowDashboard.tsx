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
import { CheckpointModal } from './CheckpointModal';
import { formatRuntime } from '../utils/formatters';
import { getOutputAgent } from '../utils/agentSelection';
import { useCtrlCHandler } from '../hooks/useCtrlCHandler';
import { calculateMainContentHeight } from '../utils/heightCalculations';
import { SpinnerProvider } from '../contexts/SpinnerContext';

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
  | { type: 'SELECT_ITEM'; itemId: string; itemType: 'main' | 'summary' | 'sub' }
  | { type: 'CHECKPOINT_CONTINUE' }
  | { type: 'CHECKPOINT_QUIT' };

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

  // Saved scroll position for history view (to restore when returning from log viewer)
  const [savedHistoryScrollOffset, setSavedHistoryScrollOffset] = useState<number | undefined>(undefined);
  const [savedHistorySelectedIndex, setSavedHistorySelectedIndex] = useState<number | undefined>(undefined);

  // Track checkpoint freeze time to pause the timer
  const [checkpointFreezeTime, setCheckpointFreezeTime] = useState<number | undefined>(undefined);

  useCtrlCHandler();

  // Track when checkpoint becomes active/inactive and freeze/unfreeze timer
  useEffect(() => {
    if (state.checkpointState?.active && !checkpointFreezeTime) {
      // Checkpoint just became active - freeze the timer at current time
      setCheckpointFreezeTime(Date.now());
    } else if (!state.checkpointState?.active && checkpointFreezeTime) {
      // Checkpoint just closed - unfreeze timer
      setCheckpointFreezeTime(undefined);
    }
  }, [state.checkpointState?.active, checkpointFreezeTime]);

  // Update runtime every second (or freeze if endTime or checkpoint is set)
  useEffect(() => {
    const interval = setInterval(() => {
      // Use checkpoint freeze time if active, otherwise use workflow endTime
      const effectiveEndTime = checkpointFreezeTime ?? state.endTime;
      setRuntime(formatRuntime(state.startTime, effectiveEndTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [state.startTime, state.endTime, checkpointFreezeTime]);

  // Keyboard event handling - disabled when other views are active
  useInput(
    (input, key) => {
      if (key.ctrl && input === 's') {
        onAction({ type: 'SKIP' });
      } else if (input === 'h') {
        setShowHistory(!showHistory);
        onAction({ type: 'TOGGLE_TELEMETRY' });
      } else if (key.upArrow) {
        onAction({ type: 'NAVIGATE_UP', visibleItemCount: state.visibleItemCount });
      } else if (key.downArrow) {
        onAction({ type: 'NAVIGATE_DOWN', visibleItemCount: state.visibleItemCount });
      } else if (key.return) {
        // Enter key has dual functionality:
        // 1. If summary row selected → toggle expand/collapse
        // 2. If main agent or subagent selected → open log viewer
        if (state.selectedItemType === 'summary' && state.selectedAgentId) {
          // Toggle expand/collapse for summary
          onAction({ type: 'TOGGLE_EXPAND', agentId: state.selectedAgentId });
        } else {
          // Open log viewer for main agent or subagent
          const agentId = state.selectedSubAgentId || state.selectedAgentId;
          if (agentId) {
            setLogViewerAgentId(agentId);
          }
        }
      }
    },
    {
      isActive:
        !state.checkpointState?.active &&
        !showHistory &&
        !logViewerAgentId &&
        !historyLogViewerMonitoringId,
    }
  );

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

  // Pre-calculate panel-constrained heights (subtract horizontal separators above/below panels)
  const PANEL_SEPARATOR_LINES = 2;
  const timelineAvailableHeight = Math.max(4, mainContentHeight - PANEL_SEPARATOR_LINES);

  // Log viewer from history view (highest priority)
  if (historyLogViewerMonitoringId !== null) {
    return (
      <LogViewer
        uiAgentId={historyLogViewerMonitoringId.toString()}
        onClose={() => {
          setHistoryLogViewerMonitoringId(null);
          // Return to history view (scroll position will be restored)
          setShowHistory(true);
        }}
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
        onClose={() => {
          setShowHistory(false);
          // Clear saved position when closing history view
          setSavedHistoryScrollOffset(undefined);
          setSavedHistorySelectedIndex(undefined);
        }}
        onOpenLogViewer={(monitoringId) => {
          setHistoryLogViewerMonitoringId(monitoringId);
          // History view will be hidden when log viewer opens
          setShowHistory(false);
        }}
        savedScrollOffset={savedHistoryScrollOffset}
        savedSelectedIndex={savedHistorySelectedIndex}
        onScrollStateChange={(scrollOffset, selectedIndex) => {
          setSavedHistoryScrollOffset(scrollOffset);
          setSavedHistorySelectedIndex(selectedIndex);
        }}
      />
    );
  }

  // Checkpoint modal - Full screen replacement when active
  if (state.checkpointState?.active) {
    return (
      <CheckpointModal
        reason={state.checkpointState.reason}
        onContinue={() => onAction({ type: 'CHECKPOINT_CONTINUE' })}
        onQuit={() => onAction({ type: 'CHECKPOINT_QUIT' })}
      />
    );
  }

  // Main workflow view
  return (
    <SpinnerProvider>
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
          <Box width={leftPanelWidth} flexDirection="column" height="100%">
            <Text color="cyan">{'─'.repeat(leftPanelWidth)}</Text>
            <AgentTimeline
              mainAgents={state.agents}
              subAgents={state.subAgents}
              triggeredAgents={state.triggeredAgents}
              uiElements={state.uiElements}
              selectedAgentId={state.selectedAgentId}
              expandedNodes={state.expandedNodes}
              selectedSubAgentId={state.selectedSubAgentId}
              selectedItemType={state.selectedItemType}
              scrollOffset={state.scrollOffset}
              availableHeight={timelineAvailableHeight}
              onToggleExpand={(agentId) => onAction({ type: 'TOGGLE_EXPAND', agentId })}
              onVisibleCountChange={(count) => onAction({ type: 'SET_VISIBLE_COUNT', count })}
              onScrollOffsetChange={(offset, count) =>
                onAction({ type: 'SET_SCROLL_OFFSET', offset, visibleItemCount: count })
              }
            />
            <Text color="cyan">{'─'.repeat(leftPanelWidth)}</Text>
          </Box>

          {/* Agent Output - Takes remaining space with constrained height */}
          <Box flexGrow={1} flexDirection="column" height="100%">
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
    </SpinnerProvider>
  );
};
