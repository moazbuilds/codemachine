import type { WorkflowTemplate } from '../templates/index.js';
import { syncCodexConfig } from '../../../../infra/engines/codex/index.js';

export async function syncWorkflowAgents(template: WorkflowTemplate): Promise<void> {
  const workflowAgents = Array.from(
    template.steps
      .filter((step) => step.type === 'module')
      .reduce((acc, step) => {
        const id = step.agentId?.trim();
        if (!id) return acc;
        const existing = acc.get(id) ?? { id };
        acc.set(id, {
          ...existing,
          id,
          model: step.model ?? existing.model,
          modelReasoningEffort: step.modelReasoningEffort ?? existing.modelReasoningEffort,
        });
        return acc;
      }, new Map<string, { id: string; model?: unknown; modelReasoningEffort?: unknown }>()).values(),
  );

  if (workflowAgents.length > 0) {
    await syncCodexConfig({ additionalAgents: workflowAgents });
  }
}
