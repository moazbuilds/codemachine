import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const AGENT_MODULE_FILENAMES = ['sub.agents.js', 'main.agents.js', 'modules.js', 'agents.js'];
const AGENT_JSON_RELATIVE_PATH = join('.codemachine', 'agents', 'agents-config.json');

export type AgentsModuleLookupOptions = {
  projectRoot?: string;
};

export function resolveAgentsModulePath(options: AgentsModuleLookupOptions = {}): string | undefined {
  const projectRoot = options.projectRoot ? resolve(options.projectRoot) : undefined;
  if (!projectRoot) {
    return undefined;
  }

  const candidates = [join(projectRoot, AGENT_JSON_RELATIVE_PATH)];

  for (const filename of AGENT_MODULE_FILENAMES) {
    candidates.push(join(projectRoot, 'config', filename));
    candidates.push(join(projectRoot, 'dist', 'config', filename));
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}
