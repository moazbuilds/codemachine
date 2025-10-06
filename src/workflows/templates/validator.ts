import type { WorkflowTemplate } from './types.js';

export function isWorkflowTemplate(value: unknown): value is WorkflowTemplate {
  if (!value || typeof value !== 'object') return false;
  const obj = value as { name?: unknown; steps?: unknown };
  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) return false;
  if (!Array.isArray(obj.steps)) return false;
  return obj.steps.every((step) => {
    if (!step || typeof step !== 'object') return false;
    const candidate = step as {
      type?: unknown;
      agentId?: unknown;
      agentName?: unknown;
      promptPath?: unknown;
      model?: unknown;
      modelReasoningEffort?: unknown;
      module?: unknown;
      executeOnce?: unknown;
    };
    if (
      candidate.type !== 'module' ||
      typeof candidate.agentId !== 'string' ||
      typeof candidate.agentName !== 'string' ||
      typeof candidate.promptPath !== 'string'
    ) {
      return false;
    }

    if (candidate.model !== undefined && typeof candidate.model !== 'string') {
      return false;
    }

    if (
      candidate.modelReasoningEffort !== undefined &&
      candidate.modelReasoningEffort !== 'low' &&
      candidate.modelReasoningEffort !== 'medium' &&
      candidate.modelReasoningEffort !== 'high'
    ) {
      return false;
    }

    if (candidate.executeOnce !== undefined && typeof candidate.executeOnce !== 'boolean') {
      return false;
    }

    if (candidate.module === undefined) {
      return true;
    }

    if (!candidate.module || typeof candidate.module !== 'object') {
      return false;
    }

    const moduleMeta = candidate.module as {
      id?: unknown;
      behavior?: unknown;
    };

    if (typeof moduleMeta.id !== 'string') {
      return false;
    }

    if (moduleMeta.behavior === undefined) {
      return true;
    }

    if (!moduleMeta.behavior || typeof moduleMeta.behavior !== 'object') {
      return false;
    }

    const behavior = moduleMeta.behavior as {
      type?: unknown;
      action?: unknown;
      steps?: unknown;
      trigger?: unknown;
      maxIterations?: unknown;
    };

    if (behavior.type !== 'loop' || behavior.action !== 'stepBack') {
      return false;
    }

    if (typeof behavior.steps !== 'number' || behavior.steps <= 0) {
      return false;
    }

    if (typeof behavior.trigger !== 'string') {
      return false;
    }

    if (behavior.maxIterations !== undefined && typeof behavior.maxIterations !== 'number') {
      return false;
    }

    return true;
  });
}
