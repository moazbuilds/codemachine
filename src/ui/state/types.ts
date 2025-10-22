import type { EngineType } from '../../infra/engines/index.js';

/**
 * Agent execution status types
 */
export type AgentStatus =
  | 'pending'      // ○ - Not yet started
  | 'running'      // ⠋ - Currently executing
  | 'completed'    // ✓ - Successfully finished
  | 'skipped'      // ● - Skipped in loop
  | 'retrying';    // ⟳ - Retrying after failure

/**
 * Agent telemetry data tracked across all engines
 */
export interface AgentTelemetry {
  tokensIn: number;
  tokensOut: number;
  cached?: number;      // Optional: not all engines provide
  cost?: number;        // Optional: calculated if pricing available
  duration?: number;    // Optional: in seconds
}

/**
 * Complete state for a main workflow agent
 */
export interface AgentState {
  id: string;
  name: string;
  engine: EngineType;
  status: AgentStatus;
  telemetry: AgentTelemetry;
  startTime: number;
  endTime?: number;
  error?: string;
  toolCount: number;
  thinkingCount: number;
  loopRound?: number;  // Current loop iteration number (e.g., 1, 2, 3...)
  stepIndex?: number;  // Current step index (0-based)
  totalSteps?: number; // Total number of steps in workflow
}

/**
 * Sub-agent state extending main agent with parent reference
 */
export interface SubAgentState extends AgentState {
  parentId: string;
}

/**
 * Triggered agent state with source attribution
 */
export interface TriggeredAgentState extends AgentState {
  triggeredBy: string;  // Source agent ID
  triggerCondition?: string;  // Optional: condition that triggered the agent
}

/**
 * Loop execution state
 */
export interface LoopState {
  active: boolean;
  sourceAgent: string;
  backSteps: number;
  iteration: number;
  maxIterations: number;
  skipList: string[];
}

/**
 * Workflow execution status
 */
export type WorkflowStatus = 'running' | 'completed' | 'stopped';

/**
 * Complete workflow UI state
 */
export interface WorkflowState {
  workflowName: string;
  version: string;
  packageName: string;
  startTime: number;

  agents: AgentState[];
  subAgents: Map<string, SubAgentState[]>;
  triggeredAgents: TriggeredAgentState[];

  loopState: LoopState | null;
  expandedNodes: Set<string>;

  outputBuffers: Map<string, string[]>;     // Agent ID -> buffer mapping (last 1000 lines per agent)
  outputBuffer: string[];     // Current selected agent's output buffer (for backward compatibility)

  showTelemetryView: boolean;
  selectedAgentId: string | null;
  selectedSubAgentId: string | null;
  selectedItemType: 'main' | 'summary' | 'sub' | null;  // Track what type of item is selected

  // Workflow progress tracking
  totalSteps: number;
  workflowStatus: WorkflowStatus;  // Current execution status
  waitingForExit: boolean;  // True when first Ctrl+C pressed, waiting for second to exit
}
