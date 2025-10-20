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
  engine: 'claude' | 'codex' | 'cursor';
  status: AgentStatus;
  telemetry: AgentTelemetry;
  startTime: number;
  endTime?: number;
  error?: string;
  toolCount: number;
  thinkingCount: number;
  loopRound?: number;  // Current loop iteration number (e.g., 1, 2, 3...)
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
  scrollPosition: number;
  autoScroll: boolean;

  showTelemetryView: boolean;
  selectedAgentId: string | null;
  selectedSubAgentId: string | null;
}
