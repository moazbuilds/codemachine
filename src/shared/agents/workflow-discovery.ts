import { existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';

import { loadWorkflowModule, isWorkflowTemplate } from '../../core/workflows/manager/template-loader.js';

export type WorkflowAgentDefinition = {
  id: string;
  name?: string;
  promptPath?: string;
  model?: string;
  modelReasoningEffort?: 'low' | 'medium' | 'high';
};

function gatherWorkflowFiles(root: string): string[] {
  const templateDir = path.join(root, 'templates', 'workflows');
  if (!existsSync(templateDir)) {
    return [];
  }

  return readdirSync(templateDir)
    .filter((file) => file.endsWith('.workflow.js'))
    .map((file) => path.resolve(templateDir, file));
}

export async function collectAgentsFromWorkflows(roots: string[]): Promise<WorkflowAgentDefinition[]> {
  const files = new Set<string>();
  for (const root of roots) {
    if (!root) continue;
    const resolvedRoot = path.resolve(root);
    for (const filePath of gatherWorkflowFiles(resolvedRoot)) {
      files.add(filePath);
    }
  }

  const byId = new Map<string, WorkflowAgentDefinition>();

  for (const filePath of files) {
    try {
      const template = await loadWorkflowModule(filePath);
      if (!isWorkflowTemplate(template)) {
        continue;
      }

      for (const step of template.steps) {
        if (!step || step.type !== 'module') {
          continue;
        }
        const id = typeof step.agentId === 'string' ? step.agentId.trim() : '';
        if (!id) {
          continue;
        }

        const existing = byId.get(id) ?? {};
        byId.set(id, {
          ...existing,
          id,
          name: step.agentName ?? existing.name,
          promptPath: step.promptPath ?? existing.promptPath,
          model: step.model ?? existing.model,
          modelReasoningEffort: step.modelReasoningEffort ?? existing.modelReasoningEffort,
        });
      }
    } catch (error) {
      // Ignore invalid workflow modules; other files may still provide definitions.
      continue;
    }
  }

  return Array.from(byId.values());
}
