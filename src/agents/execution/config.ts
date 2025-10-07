import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

import { resolveAgentsModulePath } from '../../shared/agents/index.js';
import type { AgentDefinition } from '../../shared/agents/config/types.js';

export type AgentConfig = AgentDefinition & {
  name: string;
  description?: string;
  promptPath: string;
};

/**
 * Loads the agent configuration by ID
 */
export async function loadAgentConfig(agentId: string, projectRoot?: string): Promise<AgentConfig> {
  const lookupBase = projectRoot ?? process.env.CODEMACHINE_CWD ?? process.cwd();
  const agentsPath = resolveAgentsModulePath({ projectRoot: lookupBase });

  if (!agentsPath) {
    throw new Error('Unable to locate agents configuration. Expected config/sub.agents.js, config/main.agents.js, or .codemachine/agents/agents-config.json in the project root.');
  }

  const require = createRequire(import.meta.url);
  try {
    delete require.cache[require.resolve(agentsPath)];
  } catch {
    // ignore cache miss
  }

  const agents = require(agentsPath) as AgentConfig[];
  const config = agents.find((a) => a.id === agentId);
  if (!config) {
    throw new Error(`Unknown agent id: ${agentId}`);
  }

  return config;
}

/**
 * Loads the agent prompt template
 */
export async function loadAgentTemplate(agentId: string, projectRoot?: string): Promise<string> {
  const config = await loadAgentConfig(agentId, projectRoot);
  const lookupBase = projectRoot ?? process.env.CODEMACHINE_CWD ?? process.cwd();
  const agentsPath = resolveAgentsModulePath({ projectRoot: lookupBase });

  if (!agentsPath) {
    throw new Error('Unable to locate agents configuration.');
  }

  const promptBase = path.dirname(agentsPath);
  const promptPath = path.isAbsolute(config.promptPath) ? config.promptPath : path.resolve(promptBase, config.promptPath);
  const content = await fs.readFile(promptPath, 'utf-8');
  return content;
}
