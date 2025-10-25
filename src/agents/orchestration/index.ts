/**
 * Agent Orchestration System
 *
 * Provides multi-agent coordination with parallel and sequential execution:
 * - Parse orchestration scripts with & (parallel) and && (sequential)
 * - Execute agents in coordinated groups
 * - Track parent-child relationships in monitoring
 */

export { OrchestrationService } from './orchestrator.js';
export { OrchestrationParser } from './parser.js';
export { EnhancedCommandParser } from './enhanced-parser.js';
export { InputFileProcessor } from './input-processor.js';
export { OrchestrationExecutor } from './executor.js';
export type {
  ExecutionMode,
  AgentCommand,
  CommandGroup,
  ExecutionPlan,
  AgentExecutionResult,
  OrchestrationResult
} from './types';
