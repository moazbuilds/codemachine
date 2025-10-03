import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';

const TEMPLATE_TRACKING_FILE = 'template.json';

interface TemplateTracking {
  activeTemplate: string;
  lastUpdated: string;
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
