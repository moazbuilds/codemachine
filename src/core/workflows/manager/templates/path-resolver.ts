import * as path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

/**
 * @deprecated This function is deprecated. Templates are now loaded from .codemachine/template.json
 * Use getTemplatePathFromTracking from template-tracking.ts instead
 */
export function resolveTemplateFromSettings(): string | undefined {
  // Settings.js is no longer used for template configuration
  // Templates are now managed per-project in .codemachine/template.json
  return undefined;
}
