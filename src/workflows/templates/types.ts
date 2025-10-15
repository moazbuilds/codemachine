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

export type ModuleBehavior = LoopModuleBehavior | TriggerModuleBehavior;

export interface ModuleMetadata {
  id: string;
  behavior?: ModuleBehavior;
}

export interface WorkflowStep {
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

export interface WorkflowTemplate {
  name: string;
  steps: WorkflowStep[];
  subAgentIds?: string[];
}

export type ModuleName = WorkflowStep['agentId'];

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
