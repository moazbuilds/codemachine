export type UnknownRecord = Record<string, unknown>;

export type ModuleName = 'agents-builder' | 'planning-workflow' | 'project-manager';

export interface WorkflowStep {
  type: 'module';
  module: ModuleName;
  agentId: string;
  agentName: string;
  promptPath: string;
  options?: UnknownRecord;
}

export interface WorkflowTemplate {
  name: string;
  steps: WorkflowStep[];
}

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
