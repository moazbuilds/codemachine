import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE_TRACKING_FILE = 'template.json';

// Resolve package root to find templates directory
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

interface TemplateTracking {
  activeTemplate: string;
  lastUpdated: string;
  completedSteps?: number[];
  notCompletedSteps?: number[];
}

/**
 * Gets the currently active template name from the tracking file.
 */
export async function getActiveTemplate(cmRoot: string): Promise<string | null> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  if (!existsSync(trackingPath)) {
    return null;
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;
    return data.activeTemplate ?? null;
  } catch {
    return null;
  }
}

/**
 * Sets the active template name in the tracking file.
 */
export async function setActiveTemplate(cmRoot: string, templateName: string): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  const data: TemplateTracking = {
    activeTemplate: templateName,
    lastUpdated: new Date().toISOString(),
  };

  await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Checks if the provided template is different from the currently active one.
 * Returns true if:
 * - There is an active template and it's different from the provided one
 * - There is no active template but we have a new one (first run with template)
 */
export async function hasTemplateChanged(cmRoot: string, templateName: string): Promise<boolean> {
  const activeTemplate = await getActiveTemplate(cmRoot);

  // If no active template, treat it as changed (first run with template should regenerate)
  if (activeTemplate === null) {
    return true;
  }

  // Check if the template is different
  return activeTemplate !== templateName;
}

/**
 * Gets the full template path from the tracking file.
 * Returns the default template if no template is tracked.
 */
export async function getTemplatePathFromTracking(cmRoot: string): Promise<string> {
  const activeTemplate = await getActiveTemplate(cmRoot);

  if (!activeTemplate) {
    // No template tracked, return default
    return path.join(templatesDir, 'default.workflow.js');
  }

  // Return full path from template name
  return path.join(templatesDir, activeTemplate);
}
