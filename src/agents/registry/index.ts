import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  promptPath: string;
}

const agentCache = new Map<string, Promise<AgentDefinition[]>>();

async function loadAgents(baseDir: string): Promise<AgentDefinition[]> {
  const normalizedBaseDir = resolve(baseDir);

  let cached = agentCache.get(normalizedBaseDir);
  if (!cached) {
    cached = importAgents(normalizedBaseDir);
    agentCache.set(normalizedBaseDir, cached);
  }

  return cached;
}

async function importAgents(baseDir: string): Promise<AgentDefinition[]> {
  const modulePath = resolve(baseDir, 'inputs', 'agents.js');
  const moduleUrl = pathToFileURL(modulePath).href;
  const namespace = await import(moduleUrl);

  const exported = (namespace as { default?: unknown }).default ?? (namespace as unknown);

  if (!Array.isArray(exported)) {
    throw new TypeError(`Expected agents module at ${modulePath} to export an array`);
  }

  const agents = exported.map((raw, index) => normalizeAgent(raw, index, baseDir));
  return agents.map((agent) => ({ ...agent }));
}

function normalizeAgent(raw: unknown, index: number, baseDir: string): AgentDefinition {
  if (typeof raw !== 'object' || raw === null) {
    throw new TypeError(`Agent definition at index ${index} must be an object`);
  }

  const { id, name, description, promptPath } = raw as Record<string, unknown>;

  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new TypeError(`Agent definition at index ${index} is missing a valid "id" string`);
  }

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new TypeError(`Agent definition at index ${index} is missing a valid "name" string`);
  }

  if (typeof description !== 'string' || description.trim().length === 0) {
    throw new TypeError(`Agent definition at index ${index} is missing a valid "description" string`);
  }

  if (typeof promptPath !== 'string' || promptPath.length === 0) {
    throw new TypeError(`Agent definition at index ${index} is missing a valid "promptPath" string`);
  }

  const absolutePromptPath = isAbsolute(promptPath)
    ? promptPath
    : resolve(baseDir, promptPath);

  return {
    id,
    name,
    description,
    promptPath: absolutePromptPath,
  };
}

export async function listAgents(baseDir: string): Promise<AgentDefinition[]> {
  const agents = await loadAgents(baseDir);
  return agents.map((agent) => ({ ...agent }));
}

export async function getAgent(id: string, baseDir: string): Promise<AgentDefinition | undefined> {
  const agents = await loadAgents(baseDir);
  const match = agents.find((agent) => agent.id === id);
  return match ? { ...match } : undefined;
}

export async function requireAgent(id: string, baseDir: string): Promise<AgentDefinition> {
  const agent = await getAgent(id, baseDir);
  if (!agent) {
    throw new Error(`Agent with id "${id}" was not found for base directory ${resolve(baseDir)}`);
  }

  return agent;
}
