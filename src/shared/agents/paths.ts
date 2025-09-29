import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const AGENT_MODULE_FILENAME = 'agents.js';
const AGENT_JSON_RELATIVE_PATH = join('.codemachine', 'agents', 'agents-config.json');

export type AgentsModuleLookupOptions = {
  projectRoot?: string;
};

export function resolveAgentsModulePath(options: AgentsModuleLookupOptions = {}): string | undefined {
  const projectRoot = options.projectRoot ? resolve(options.projectRoot) : undefined;
  if (!projectRoot) {
    return undefined;
  }

  const candidates = [
    join(projectRoot, AGENT_JSON_RELATIVE_PATH),
    join(projectRoot, 'config', AGENT_MODULE_FILENAME),
    join(projectRoot, 'dist', 'config', AGENT_MODULE_FILENAME),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}
