import * as path from 'node:path';
import type { WorkflowTemplate } from './types.js';
import { packageRoot, templatesDir } from './path-resolver.js';
import { isWorkflowTemplate } from './template-validator.js';
import { loadWorkflowModule } from './module-loader.js';

export async function loadTemplate(cwd: string, templatePath?: string): Promise<WorkflowTemplate> {
  const resolvedTemplateOverride = templatePath
    ? path.isAbsolute(templatePath)
      ? templatePath
      : path.resolve(packageRoot, templatePath)
    : undefined;
  const defaultTemplate = path.resolve(templatesDir, 'default.workflow.js');
  const candidates = [resolvedTemplateOverride, defaultTemplate].filter(Boolean) as string[];

  for (const modPath of candidates) {
    try {
      const tpl = (await loadWorkflowModule(modPath)) as unknown;
      if (isWorkflowTemplate(tpl)) return tpl;
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    `No workflow template found. Looked for: ${candidates
      .map((p) => path.relative(cwd, p))
      .join(', ')}`,
  );
}

export async function loadTemplateWithPath(cwd: string, templatePath?: string): Promise<{ template: WorkflowTemplate; resolvedPath: string }> {
  const resolvedTemplateOverride = templatePath
    ? path.isAbsolute(templatePath)
      ? templatePath
      : path.resolve(packageRoot, templatePath)
    : undefined;
  const defaultTemplate = path.resolve(templatesDir, 'default.workflow.js');
  const candidates = [resolvedTemplateOverride, defaultTemplate].filter(Boolean) as string[];

  for (const modPath of candidates) {
    try {
      const tpl = (await loadWorkflowModule(modPath)) as unknown;
      if (isWorkflowTemplate(tpl)) return { template: tpl, resolvedPath: modPath };
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    `No workflow template found. Looked for: ${candidates
      .map((p) => path.relative(cwd, p))
      .join(', ')}`,
  );
}
