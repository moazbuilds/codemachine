import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const AGENT_MODULE_FILENAME = 'agents.js';

export type AgentsModuleLookupOptions = {
  projectRoot?: string;
};

export function resolveAgentsModulePath(options: AgentsModuleLookupOptions = {}): string | undefined {
  const projectRoot = options.projectRoot ? resolve(options.projectRoot) : undefined;
  if (!projectRoot) {
    return undefined;
  }

  const candidateDirs = ['config', join('dist', 'config')];

  for (const dir of candidateDirs) {
    const candidate = join(projectRoot, dir, AGENT_MODULE_FILENAME);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}
