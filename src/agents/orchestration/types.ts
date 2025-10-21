/**
 * Types for agent orchestration
 */

/**
 * Execution mode for agents
 */
export type ExecutionMode = 'parallel' | 'sequential';

/**
 * A single agent command to execute
 */
export interface AgentCommand {
  /** Agent name/ID */
  name: string;

  /** Prompt/instruction for the agent */
  prompt: string;
}

/**
 * A group of agent commands that share the same execution mode
 */
export interface CommandGroup {
  /** Execution mode for this group */
  mode: ExecutionMode;

  /** Commands in this group */
  commands: AgentCommand[];
}

/**
 * Complete execution plan parsed from orchestration script
 */
export interface ExecutionPlan {
  /** Groups of commands with their execution modes */
  groups: CommandGroup[];
}

/**
 * Result of a single agent execution
 */
export interface AgentExecutionResult {
  /** Agent name */
  name: string;

  /** Agent ID in monitoring system */
  agentId: number;

  /** Whether execution succeeded */
  success: boolean;

  /** Output from the agent */
  output?: string;

  /** Error message if failed */
  error?: string;
}

/**
 * Result of orchestrated execution
 */
export interface OrchestrationResult {
  /** Parent agent ID (the orchestration session) */
  parentId: number;

  /** Results from all executed agents */
  results: AgentExecutionResult[];

  /** Whether all agents succeeded */
  success: boolean;
}
