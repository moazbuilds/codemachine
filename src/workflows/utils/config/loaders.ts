import { createRequire } from 'node:module';
import * as path from 'node:path';
import type { AgentConfig, ModuleConfig } from './types.js';
import { packageRoot } from '../helpers/package-root.js';

const require = createRequire(import.meta.url);

export const mainAgents = require(path.resolve(packageRoot, 'config', 'main.agents.js')) as AgentConfig[];
export const moduleCatalog = require(path.resolve(packageRoot, 'config', 'modules.js')) as ModuleConfig[];
