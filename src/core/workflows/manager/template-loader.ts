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
    const candidate = step as {
      type?: unknown;
      agentId?: unknown;
      agentName?: unknown;
      promptPath?: unknown;
      model?: unknown;
      modelReasoningEffort?: unknown;
      module?: unknown;
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

export async function loadWorkflowModule(modPath: string): Promise<unknown> {
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
