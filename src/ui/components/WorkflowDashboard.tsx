import React, { useState, useEffect } from 'react';
import { Box, useInput } from 'ink';
import type { WorkflowState } from '../state/types';
import { BrandingHeader } from './BrandingHeader';
import { ProgressLine } from './ProgressLine';
import { LoopIndicator } from './LoopIndicator';
import { AgentTimeline } from './AgentTimeline';
import { OutputWindow } from './OutputWindow';
import { TelemetryBar } from './TelemetryBar';
import { TelemetryDetailView } from './TelemetryDetailView';
import { StatusFooter } from './StatusFooter';
import { formatRuntime } from '../utils/formatters';

export interface WorkflowDashboardProps {
  state: WorkflowState;
  onAction: (action: UIAction) => void;
}

export type UIAction =
  | { type: 'PAUSE' }
  | { type: 'SKIP' }
  | { type: 'QUIT' }
  | { type: 'TOGGLE_EXPAND'; agentId: string }
  | { type: 'TOGGLE_TELEMETRY' }
  | { type: 'TOGGLE_AUTO_SCROLL' }
  | { type: 'SELECT_AGENT'; agentId: string }
  | { type: 'SELECT_SUB_AGENT'; subAgentId: string };

/**
 * Main container component for workflow UI
 * Handles keyboard events and layout orchestration
 */
export const WorkflowDashboard: React.FC<WorkflowDashboardProps> = ({
  state,
  onAction,
}) => {
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [runtime, setRuntime] = useState('00:00:00');

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
    } else if (input === 'p') {
      onAction({ type: 'PAUSE' });
    } else if (input === 's') {
      onAction({ type: 'SKIP' });
    } else if (input === 't') {
      setShowTelemetry(!showTelemetry);
      onAction({ type: 'TOGGLE_TELEMETRY' });
    } else if (input === ' ') {
      // Space key toggles auto-scroll
      onAction({ type: 'TOGGLE_AUTO_SCROLL' });
    } else if (key.return && state.selectedAgentId) {
      // Enter key toggles expansion of selected agent's sub-agents
      onAction({ type: 'TOGGLE_EXPAND', agentId: state.selectedAgentId });
    }
  });

  // Get current agent for output window
  const currentAgent = state.selectedSubAgentId
    ? Array.from(state.subAgents.values())
        .flat()
        .find((sa) => sa.id === state.selectedSubAgentId) || null
    : state.agents.find((a) => a.id === state.selectedAgentId) || null;

  // Calculate cumulative telemetry
  const cumulativeStats = {
    totalTokensIn: state.agents.reduce((sum, a) => sum + a.telemetry.tokensIn, 0),
    totalTokensOut: state.agents.reduce((sum, a) => sum + a.telemetry.tokensOut, 0),
    totalCached: state.agents.reduce((sum, a) => sum + (a.telemetry.cached || 0), 0),
    totalCost: state.agents.reduce((sum, a) => sum + (a.telemetry.cost || 0), 0),
    loopIterations: state.loopState?.iteration,
  };

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
        workflowName={state.workflowName}
        runtime={runtime}
        version={state.version}
        packageName={state.packageName}
      />

      <ProgressLine
        currentStep={state.currentStep}
        totalSteps={state.totalSteps}
        uniqueCompleted={state.uniqueCompleted}
        totalExecuted={state.totalExecuted}
        loopIteration={state.loopState?.iteration}
      />

      {state.loopState && <LoopIndicator loopState={state.loopState} />}

      {/* Main content area with fixed height constraint */}
      <Box flexGrow={1} flexDirection="row">
        {/* Workflow Steps - Fixed width */}
        <Box width={75} flexDirection="column" borderStyle="single">
          <AgentTimeline
            mainAgents={state.agents}
            subAgents={state.subAgents}
            triggeredAgents={state.triggeredAgents}
            selectedAgentId={state.selectedAgentId}
            expandedNodes={state.expandedNodes}
            selectedSubAgentId={state.selectedSubAgentId}
            onSelectAgent={(agentId) => onAction({ type: 'SELECT_AGENT', agentId })}
            onToggleExpand={(agentId) => onAction({ type: 'TOGGLE_EXPAND', agentId })}
            onSelectSubAgent={(subAgentId) => onAction({ type: 'SELECT_SUB_AGENT', subAgentId })}
          />
        </Box>

        {/* Agent Output - Takes remaining space with constrained height */}
        <Box flexGrow={1} flexDirection="column" borderStyle="single">
          <OutputWindow
            currentAgent={currentAgent}
            outputLines={state.outputBuffer}
            autoScroll={state.autoScroll}
          />
        </Box>
      </Box>

      <TelemetryBar
        current={
          currentAgent
            ? {
                tokensIn: currentAgent.telemetry.tokensIn,
                tokensOut: currentAgent.telemetry.tokensOut,
                cost: currentAgent.telemetry.cost,
                cached: currentAgent.telemetry.cached,
                engine: currentAgent.engine,
                isSubAgent: 'parentId' in currentAgent,
              }
            : undefined
        }
        cumulative={{
          tokensIn: cumulativeStats.totalTokensIn,
          tokensOut: cumulativeStats.totalTokensOut,
          cost: cumulativeStats.totalCost,
          cached: cumulativeStats.totalCached,
        }}
      />

      <StatusFooter currentView="workflow" paused={state.paused} />
    </Box>
  );
};
