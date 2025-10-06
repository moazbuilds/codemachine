export interface AgentConfig {
  id: string;
  name?: string;
  promptPath?: string;
  model?: string;
  modelReasoningEffort?: string;
  type?: string;
  [key: string]: unknown;
}

export interface ModuleBehaviorConfig {
  type?: string;
  action?: string;
  steps?: number;
  trigger?: string;
  maxIterations?: number;
  skip?: string[];
  [key: string]: unknown;
}

export interface ModuleConfig extends AgentConfig {
  behavior?: ModuleBehaviorConfig;
}
