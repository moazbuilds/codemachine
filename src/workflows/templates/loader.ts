import * as path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { WorkflowTemplate } from './types.js';
import { isWorkflowTemplate } from './validator.js';
import { ensureTemplateGlobals } from './globals.js';

// Package root resolution
export const packageRoot = (() => {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  let current = moduleDir;
  while (true) {
    if (existsSync(path.join(current, 'package.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return moduleDir;
    current = parent;
  }
})();

export const templatesDir = path.resolve(packageRoot, 'templates', 'workflows');

// Module loading
export async function loadWorkflowModule(modPath: string): Promise<unknown> {
  ensureTemplateGlobals();
  const ext = path.extname(modPath).toLowerCase();
  if (ext === '.cjs' || ext === '.cts') {
    const require = createRequire(import.meta.url);
    try {
      delete require.cache[require.resolve(modPath)];
    } catch {
      // Ignore cache deletion errors
    }
    return require(modPath);
  }

  const fileUrl = pathToFileURL(modPath);
  const cacheBustingUrl = new URL(fileUrl.href);
  cacheBustingUrl.searchParams.set('ts', Date.now().toString());
  const mod = await import(cacheBustingUrl.href);
  return mod?.default ?? mod;
}

// Template loading
export async function loadTemplate(cwd: string, templatePath?: string): Promise<WorkflowTemplate> {
  const resolvedTemplateOverride = templatePath
    ? path.isAbsolute(templatePath)
      ? templatePath
      : path.resolve(packageRoot, templatePath)
    : undefined;
  const codemachineTemplate = path.resolve(templatesDir, 'codemachine.workflow.js');
  const candidates = [resolvedTemplateOverride, codemachineTemplate].filter(Boolean) as string[];

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
  const codemachineTemplate = path.resolve(templatesDir, 'codemachine.workflow.js');
  const candidates = [resolvedTemplateOverride, codemachineTemplate].filter(Boolean) as string[];

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
