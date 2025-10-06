import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import type { AgentDefinition } from './discovery.js';

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function writeFileIfChanged(filePath: string, content: string): Promise<void> {
  try {
    const existing = await readFile(filePath, 'utf8');
    if (existing === content) return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await writeFile(filePath, content, 'utf8');
}

export async function ensurePromptFile(filePath: string): Promise<void> {
  try {
    await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await writeFile(filePath, '', 'utf8');
  }
}

export function slugify(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function ensureSpecificationsTemplate(inputsDir: string): Promise<void> {
  const specPath = path.join(inputsDir, 'specifications.md');
  try {
    await readFile(specPath, 'utf8');
    return; // exists, do not overwrite
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const template = `# Project Specifications\n\n- Describe goals, constraints, and context.\n- Link any relevant docs or tickets.\n- This file is created by workspace bootstrap and can be safely edited.\n`;
  await writeFile(specPath, template, 'utf8');
}

export async function mirrorAgentsToJson(agentsDir: string, agents: AgentDefinition[]): Promise<void> {
  await ensureDir(agentsDir);

  const normalizedAgents = await Promise.all(
    agents.map(async (agent) => {
      const rawId = agent.id ?? agent.name ?? 'agent';
      const slugBase = slugify(rawId) || 'agent';
      const filename = `${slugBase}.md`;
      const promptFile = path.join(agentsDir, filename);
      await ensurePromptFile(promptFile);
      return { ...agent, promptPath: filename };
    }),
  );

  const target = path.join(agentsDir, 'agents-config.json');
  const json = `${JSON.stringify(normalizedAgents, null, 2)}\n`;
  await writeFileIfChanged(target, json);
}
