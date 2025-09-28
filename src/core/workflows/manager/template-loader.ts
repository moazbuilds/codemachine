import * as path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { UnknownRecord, WorkflowTemplate } from './types.js';

const packageRoot = (() => {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  let current = moduleDir;
  while (true) {
    if (existsSync(path.join(current, 'package.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return moduleDir;
    current = parent;
  }
})();

const templatesDir = path.resolve(packageRoot, 'templates', 'workflows');

export function resolveTemplateFromSettings(): string | undefined {
  const settingsPath = path.resolve(packageRoot, 'config', 'settings.js');
  const require = createRequire(import.meta.url);
  try {
    delete require.cache[require.resolve(settingsPath)];
    const settings = require(settingsPath) as UnknownRecord;
    const workflowSettings = (settings?.workflow ?? {}) as UnknownRecord;
    const templateValue = workflowSettings.template;
    if (typeof templateValue === 'string' && templateValue.trim().length > 0) {
      const candidate = templateValue.endsWith('.workflow.js') ? templateValue : `${templateValue}.workflow.js`;
      return path.isAbsolute(candidate)
        ? candidate
        : path.resolve(templatesDir, candidate);
    }
  } catch {
    // fall through to defaults
  }
  return undefined;
}

export function isWorkflowTemplate(value: unknown): value is WorkflowTemplate {
  if (!value || typeof value !== 'object') return false;
  const obj = value as { name?: unknown; steps?: unknown };
  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) return false;
  if (!Array.isArray(obj.steps)) return false;
  return obj.steps.every((step) => {
    if (!step || typeof step !== 'object') return false;
    const candidate = step as { type?: unknown; module?: unknown; agentId?: unknown; agentName?: unknown; promptPath?: unknown };
    return (
      candidate.type === 'module' &&
      typeof candidate.module === 'string' &&
      typeof candidate.agentId === 'string' &&
      typeof candidate.agentName === 'string' &&
      typeof candidate.promptPath === 'string'
    );
  });
}

export async function loadWorkflowModule(modPath: string): Promise<unknown> {
  const ext = path.extname(modPath).toLowerCase();
  if (ext === '.cjs' || ext === '.cts') {
    const require = createRequire(import.meta.url);
    try {
      delete require.cache[require.resolve(modPath)];
    } catch {}
    return require(modPath);
  }

  const fileUrl = pathToFileURL(modPath);
  const cacheBustingUrl = new URL(fileUrl.href);
  cacheBustingUrl.searchParams.set('ts', Date.now().toString());
  const mod = await import(cacheBustingUrl.href);
  return mod?.default ?? mod;
}

export async function loadTemplate(cwd: string, templatePath?: string): Promise<WorkflowTemplate> {
  const selectedFromSettings = resolveTemplateFromSettings();
  const resolvedTemplateOverride = templatePath
    ? path.isAbsolute(templatePath)
      ? templatePath
      : path.resolve(packageRoot, templatePath)
    : undefined;
  const defaultTemplate = path.resolve(templatesDir, 'default.workflow.js');
  const candidates = [resolvedTemplateOverride, selectedFromSettings, defaultTemplate].filter(Boolean) as string[];

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
