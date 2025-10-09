import type { AgentDefinition } from './types.js';
import { MODEL, MODEL_REASONING_EFFORT, DEFAULT_MODEL_EFFORT, VALID_MODEL_EFFORTS } from './types.js';

export function toTomlString(value: string): string {
  return JSON.stringify(value);
}

export function resolveModel(agent: AgentDefinition): string {
  if (typeof agent.model === 'string' && agent.model.trim()) {
    return agent.model.trim();
  }

  return MODEL;
}

export function resolveEffort(agent: AgentDefinition): 'low' | 'medium' | 'high' {
  const candidate =
    typeof agent.modelReasoningEffort === 'string'
      ? agent.modelReasoningEffort
      : typeof agent.model_reasoning_effort === 'string'
        ? agent.model_reasoning_effort
        : undefined;

  if (candidate) {
    const normalized = candidate.trim().toLowerCase();
    if (VALID_MODEL_EFFORTS.has(normalized)) {
      return normalized as 'low' | 'medium' | 'high';
    }
  }

  return DEFAULT_MODEL_EFFORT;
}

export function buildConfigContent(agents: AgentDefinition[]): string {
  const lines = [
    '# Model configuration',
    `model = ${toTomlString(MODEL)}`,
    `model_reasoning_effort = ${toTomlString(MODEL_REASONING_EFFORT)}`
  ];

  const profileSections = agents
    .filter((agent): agent is AgentDefinition & { id: string } => typeof agent?.id === 'string')
    .map((agent) => {
      const effort = resolveEffort(agent);
      const model = resolveModel(agent);
      return [
        `[profiles.${agent.id}]`,
        `model = ${toTomlString(model)}`,
        `model_reasoning_effort = ${toTomlString(effort)}`
      ].join('\n');
    });

  if (profileSections.length > 0) {
    lines.push('', '# Profile configurations (dynamically generated from workflow templates and agent catalogs)');
    for (const section of profileSections) {
      lines.push('', section);
    }
  }

  return `${lines.join('\n')}\n`;
}
