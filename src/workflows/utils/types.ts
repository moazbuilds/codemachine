export interface StepOverrides {
  agentName?: string;
  promptPath?: string;
  model?: string;
  modelReasoningEffort?: string;
  engine?: 'codex' | 'claude';
  executeOnce?: boolean;
}

export interface WorkflowStep {
  type: string;
  agentId: string;
  agentName: string;
  promptPath: string;
  model: string;
  modelReasoningEffort?: string;
  engine?: 'codex' | 'claude';
  module?: ModuleMetadata;
  executeOnce?: boolean;
}

export interface LoopBehaviorConfig {
  type: 'loop';
  action: 'stepBack';
  steps: number;
  trigger: string;
  maxIterations?: number;
  skip?: string[];
}

export interface ModuleMetadata {
  id: string;
  behavior?: LoopBehaviorConfig;
}

export interface ModuleOverrides extends StepOverrides {
  loopTrigger?: string;
  loopSteps?: number;
  loopMaxIterations?: number;
  loopSkip?: string[];
}
