import React, { useState, useEffect } from 'react';
import { Box, useInput } from 'ink';
import type { WorkflowState } from '../state/types';
import { BrandingHeader } from './BrandingHeader';
import { AgentTimeline } from './AgentTimeline';
import { OutputWindow } from './OutputWindow';
import { TelemetryBar } from './TelemetryBar';
import { TelemetryDetailView } from './TelemetryDetailView';
import { StatusFooter } from './StatusFooter';
import { LogViewer } from './LogViewer';
import { formatRuntime } from '../utils/formatters';
import { getOutputAgent } from '../utils/agentSelection';

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
  | { type: 'NAVIGATE_UP' }
  | { type: 'NAVIGATE_DOWN' }
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
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [runtime, setRuntime] = useState('00:00:00');
  const [logViewerAgentId, setLogViewerAgentId] = useState<string | null>(null);

  // Update runtime every second
  useEffect(() => {
    const interval = setInterval(() => {
      setRuntime(formatRuntime(state.startTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [state.startTime]);

  // Keyboard event handling
  useInput((input, key) => {
    if (input === 'q') {
      onAction({ type: 'QUIT' });
    } else if (input === 's') {
      onAction({ type: 'SKIP' });
    } else if (input === 't') {
      setShowTelemetry(!showTelemetry);
      onAction({ type: 'TOGGLE_TELEMETRY' });
    } else if (key.upArrow) {
      onAction({ type: 'NAVIGATE_UP' });
    } else if (key.downArrow) {
      onAction({ type: 'NAVIGATE_DOWN' });
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

  // Calculate cumulative telemetry
  const cumulativeStats = {
    totalTokensIn: state.agents.reduce((sum, a) => sum + a.telemetry.tokensIn, 0),
    totalTokensOut: state.agents.reduce((sum, a) => sum + a.telemetry.tokensOut, 0),
    totalCached: state.agents.reduce((sum, a) => sum + (a.telemetry.cached || 0), 0),
    totalCost: state.agents.reduce((sum, a) => sum + (a.telemetry.cost || 0), 0),
    loopIterations: state.loopState?.iteration,
  };

  // Log viewer (highest priority)
  if (logViewerAgentId) {
    return (
      <LogViewer
        uiAgentId={logViewerAgentId}
        onClose={() => setLogViewerAgentId(null)}
        getMonitoringId={getMonitoringId}
      />
    );
  }

  // Telemetry detail view
  if (showTelemetry) {
    return (
      <TelemetryDetailView
        allAgents={state.agents}
        subAgents={state.subAgents}
        triggeredAgents={state.triggeredAgents}
        cumulativeStats={cumulativeStats}
        onClose={() => setShowTelemetry(false)}
      />
    );
  }

  // Main workflow view
  return (
    <Box flexDirection="column" height="100%">
      <BrandingHeader
        version={state.version}
        currentDir={process.cwd()}
      />

      {/* Main content area with fixed height constraint */}
      <Box flexGrow={1} flexDirection="row">
        {/* Workflow Steps - Fixed width */}
        <Box width={75} flexDirection="column" borderStyle="single" borderColor="cyan">
          <AgentTimeline
            mainAgents={state.agents}
            subAgents={state.subAgents}
            triggeredAgents={state.triggeredAgents}
            selectedAgentId={state.selectedAgentId}
            expandedNodes={state.expandedNodes}
            selectedSubAgentId={state.selectedSubAgentId}
            selectedItemType={state.selectedItemType}
            onSelectAgent={(agentId) => onAction({ type: 'SELECT_AGENT', agentId })}
            onToggleExpand={(agentId) => onAction({ type: 'TOGGLE_EXPAND', agentId })}
            onSelectSubAgent={(subAgentId) => onAction({ type: 'SELECT_SUB_AGENT', subAgentId })}
          />
        </Box>

        {/* Agent Output - Takes remaining space with constrained height */}
        <Box flexGrow={1} flexDirection="column" borderStyle="single" borderColor="cyan">
          <OutputWindow
            currentAgent={currentAgent}
            outputLines={state.outputBuffer}
            getMonitoringId={getMonitoringId}
          />
        </Box>
      </Box>

      <TelemetryBar
        workflowName={state.workflowName}
        runtime={runtime}
        total={{
          tokensIn: cumulativeStats.totalTokensIn,
          tokensOut: cumulativeStats.totalTokensOut,
          cached: cumulativeStats.totalCached,
        }}
      />

      <StatusFooter currentView="workflow" />
    </Box>
  );
};
