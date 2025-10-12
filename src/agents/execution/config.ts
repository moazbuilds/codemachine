import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { collectAgentDefinitions, resolveProjectRoot } from '../../shared/agents/index.js';
import type { AgentDefinition } from '../../shared/agents/config/types.js';

export type AgentConfig = AgentDefinition & {
  name: string;
  description?: string;
  promptPath: string;
};

/**
 * Loads the agent configuration by ID from all available agent files
 */
export async function loadAgentConfig(agentId: string, projectRoot?: string): Promise<AgentConfig> {
  const lookupBase = projectRoot ?? process.env.CODEMACHINE_CWD ?? process.cwd();
  const resolvedRoot = resolveProjectRoot(lookupBase);

  // Collect all agent definitions from all config files
  const agents = await collectAgentDefinitions(resolvedRoot);

  const config = agents.find((a) => a.id === agentId) as AgentConfig | undefined;
  if (!config) {
    throw new Error(`Unknown agent id: ${agentId}. Available agents: ${agents.map(a => a.id).join(', ')}`);
  }

  return config;
}

/**
 * Loads the agent prompt template
 */
export async function loadAgentTemplate(agentId: string, projectRoot?: string): Promise<string> {
  const config = await loadAgentConfig(agentId, projectRoot);
  const lookupBase = projectRoot ?? process.env.CODEMACHINE_CWD ?? process.cwd();
  const resolvedRoot = resolveProjectRoot(lookupBase);

  // If path is absolute, use it directly; otherwise resolve relative to project root
  const promptPath = path.isAbsolute(config.promptPath)
    ? config.promptPath
    : path.resolve(resolvedRoot, config.promptPath);

  const content = await fs.readFile(promptPath, 'utf-8');
  return content;
}
