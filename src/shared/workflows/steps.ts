import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';

const TEMPLATE_TRACKING_FILE = 'template.json';

interface TemplateTracking {
  activeTemplate: string;
  lastUpdated: string;
  completedSteps?: number[];
  notCompletedSteps?: number[];
  resumeFromLastStep?: boolean;
}

/**
 * Gets the list of completed step indices from the tracking file.
 */
export async function getCompletedSteps(cmRoot: string): Promise<number[]> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  if (!existsSync(trackingPath)) {
    return [];
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;
    return data.completedSteps ?? [];
  } catch {
    return [];
  }
}

/**
 * Marks a step as completed by adding its index to the tracking file.
 */
export async function markStepCompleted(cmRoot: string, stepIndex: number): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  let data: TemplateTracking;

  if (existsSync(trackingPath)) {
    try {
      const content = await readFile(trackingPath, 'utf8');
      data = JSON.parse(content) as TemplateTracking;
    } catch {
      // If we can't read the file, create new data
      data = {
        activeTemplate: '',
        lastUpdated: new Date().toISOString(),
        completedSteps: [],
        notCompletedSteps: [],
        resumeFromLastStep: true,
      };
    }
  } else {
    data = {
      activeTemplate: '',
      lastUpdated: new Date().toISOString(),
      completedSteps: [],
      notCompletedSteps: [],
      resumeFromLastStep: true,
    };
  }

  // Add step index if not already in the list
  if (!data.completedSteps) {
    data.completedSteps = [];
  }
  if (!data.completedSteps.includes(stepIndex)) {
    data.completedSteps.push(stepIndex);
    data.completedSteps.sort((a, b) => a - b);
  }

  data.lastUpdated = new Date().toISOString();

  await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Clears all completed steps from the tracking file.
 * Useful when starting a fresh workflow run.
 */
export async function clearCompletedSteps(cmRoot: string): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  if (!existsSync(trackingPath)) {
    return;
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;
    data.completedSteps = [];
    data.lastUpdated = new Date().toISOString();
    await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // If we can't read/write, ignore
  }
}

/**
 * Gets the list of steps that started but have not completed yet.
 */
export async function getNotCompletedSteps(cmRoot: string): Promise<number[]> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  if (!existsSync(trackingPath)) {
    return [];
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;
    return data.notCompletedSteps ?? [];
  } catch {
    return [];
  }
}

/**
 * Marks a step as started by adding its index to the notCompletedSteps array.
 */
export async function markStepStarted(cmRoot: string, stepIndex: number): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  let data: TemplateTracking;

  if (existsSync(trackingPath)) {
    try {
      const content = await readFile(trackingPath, 'utf8');
      data = JSON.parse(content) as TemplateTracking;
    } catch {
      // If we can't read the file, create new data
      data = {
        activeTemplate: '',
        lastUpdated: new Date().toISOString(),
        completedSteps: [],
        notCompletedSteps: [],
        resumeFromLastStep: true,
      };
    }
  } else {
    data = {
      activeTemplate: '',
      lastUpdated: new Date().toISOString(),
      completedSteps: [],
      notCompletedSteps: [],
      resumeFromLastStep: true,
    };
  }

  // Add step index if not already in the list
  if (!data.notCompletedSteps) {
    data.notCompletedSteps = [];
  }
  if (!data.notCompletedSteps.includes(stepIndex)) {
    data.notCompletedSteps.push(stepIndex);
    data.notCompletedSteps.sort((a, b) => a - b);
  }

  data.lastUpdated = new Date().toISOString();

  await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Removes a step from the notCompletedSteps array.
 * Called when a step successfully completes.
 */
export async function removeFromNotCompleted(cmRoot: string, stepIndex: number): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  if (!existsSync(trackingPath)) {
    return;
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;

    if (data.notCompletedSteps) {
      data.notCompletedSteps = data.notCompletedSteps.filter((idx) => idx !== stepIndex);
    }

    data.lastUpdated = new Date().toISOString();

    await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // If we can't read/write, ignore
  }
}

/**
 * Clears all not completed steps from the tracking file.
 * Useful when manually resetting failed steps.
 */
export async function clearNotCompletedSteps(cmRoot: string): Promise<void> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  if (!existsSync(trackingPath)) {
    return;
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;
    data.notCompletedSteps = [];
    data.lastUpdated = new Date().toISOString();
    await writeFile(trackingPath, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // If we can't read/write, ignore
  }
}

/**
 * Gets the resume starting index based on the first incomplete step.
 * Returns the first (lowest) number from notCompletedSteps array.
 * Falls back to 0 if the feature is disabled or array is empty.
 */
export async function getResumeStartIndex(cmRoot: string): Promise<number> {
  const trackingPath = path.join(cmRoot, TEMPLATE_TRACKING_FILE);

  if (!existsSync(trackingPath)) {
    return 0;
  }

  try {
    const content = await readFile(trackingPath, 'utf8');
    const data = JSON.parse(content) as TemplateTracking;

    // Check if resume feature is enabled
    if (!data.resumeFromLastStep) {
      return 0;
    }

    // Get the first (lowest) incomplete step index to resume from
    if (data.notCompletedSteps && data.notCompletedSteps.length > 0) {
      return Math.min(...data.notCompletedSteps);
    }

    return 0;
  } catch {
    return 0;
  }
}
