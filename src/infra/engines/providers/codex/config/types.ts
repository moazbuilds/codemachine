import type { AgentDefinition } from '../../../../../shared/agents/index.js';

export type { AgentDefinition };

export type ConfigSyncOptions = {
  projectRoot?: string;
  codexHome?: string;
  additionalAgents?: AgentDefinition[];
};

export const MODEL = 'gpt-5-codex';
export const MODEL_REASONING_EFFORT = 'high';
export const DEFAULT_MODEL_EFFORT = 'medium';
export const VALID_MODEL_EFFORTS = new Set(['low', 'medium', 'high']);
