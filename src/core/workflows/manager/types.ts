export type UnknownRecord = Record<string, unknown>;

export interface LoopModuleBehavior {
  type: 'loop';
  action: 'stepBack';
  steps: number;
  trigger: string;
  maxIterations?: number;
}

export type ModuleBehavior = LoopModuleBehavior;

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
  module?: ModuleMetadata;
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
  force?: boolean;
}

export interface TaskManagerOptions {
  cwd: string;
  tasksPath?: string;
  logsPath?: string;
  parallel?: boolean;
  abortSignal?: AbortSignal;
  execute?: (agentId: string, prompt: string) => Promise<string>;
}
