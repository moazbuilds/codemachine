import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

import type { ConfigSyncOptions } from './types.js';
import { resolveProjectRoot, collectAgentDefinitions, mergeAdditionalAgents } from '../../../../shared/agents/index.js';
import { buildConfigContent } from './config-builder.js';

export async function resolveCodexHome(codexHome?: string): Promise<string> {
  const targetHome = codexHome ?? process.env.CODEX_HOME ?? path.join(homedir(), '.codemachine', 'codex');
  await mkdir(targetHome, { recursive: true });
  return targetHome;
}

async function writeConfigIfChanged(configDir: string, content: string): Promise<void> {
  const configPath = path.join(configDir, 'config.toml');

  try {
    const existingContent = await readFile(configPath, 'utf8');
    if (existingContent === content) {
      return;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  await writeFile(configPath, content, 'utf8');
}

/**
 * Synchronises the Codex configuration file with the discovered agent definitions.
 */
export async function syncCodexConfig(options?: ConfigSyncOptions): Promise<void> {
  const projectRoot = resolveProjectRoot(options?.projectRoot);
  const agents = mergeAdditionalAgents(await collectAgentDefinitions(projectRoot), options?.additionalAgents);
  const codexHome = await resolveCodexHome(options?.codexHome);
  const configContent = buildConfigContent(agents);

  await writeConfigIfChanged(codexHome, configContent);
}
