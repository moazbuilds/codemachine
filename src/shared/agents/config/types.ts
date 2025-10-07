export type AgentDefinition = {
  id: string;
  model?: unknown;
  modelReasoningEffort?: unknown;
  model_reasoning_effort?: unknown;
  engine?: 'codex' | 'claude'; // Engine to use for this agent
  [key: string]: unknown;
};

export const AGENT_MODULE_FILENAMES = ['main.agents.js', 'sub.agents.js', 'modules.js', 'agents.js'];
