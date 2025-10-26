export type UnknownRecord = Record<string, unknown>;

export interface LoopModuleBehavior {
  type: 'loop';
  action: 'stepBack';
  steps: number;
  trigger?: string; // Optional: behavior now controlled via .codemachine/memory/behavior.json
  maxIterations?: number;
  skip?: string[];
}

export interface TriggerModuleBehavior {
  type: 'trigger';
  action: 'mainAgentCall';
  triggerAgentId: string; // Agent ID to trigger
}

export interface CheckpointModuleBehavior {
  type: 'checkpoint';
  action: 'evaluate';
}

export type ModuleBehavior = LoopModuleBehavior | TriggerModuleBehavior | CheckpointModuleBehavior;

export interface ModuleMetadata {
  id: string;
  behavior?: ModuleBehavior;
}

export interface ModuleStep {
  type: 'module';
  agentId: string;
  agentName: string;
  promptPath: string;
  model?: string;
  modelReasoningEffort?: 'low' | 'medium' | 'high';
  engine?: string; // Dynamic engine type from registry
  module?: ModuleMetadata;
  executeOnce?: boolean;
  notCompletedFallback?: string; // Agent ID to run if step is in notCompletedSteps
}

export interface UIStep {
  type: 'ui';
  text: string;
}

export type WorkflowStep = ModuleStep | UIStep;

/**
 * Type guard to check if a step is a ModuleStep
 */
export function isModuleStep(step: WorkflowStep): step is ModuleStep {
  return step.type === 'module';
}

export interface WorkflowTemplate {
  name: string;
  steps: WorkflowStep[];
  subAgentIds?: string[];
}

export type ModuleName = ModuleStep['agentId'];

export interface RunWorkflowOptions {
  cwd?: string;
  templatePath?: string;
  specificationPath?: string;
}

export interface TaskManagerOptions {
  cwd: string;
  tasksPath?: string;
  logsPath?: string;
  parallel?: boolean;
  abortSignal?: AbortSignal;
  execute?: (agentId: string, prompt: string) => Promise<string>;
}
