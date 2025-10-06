import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Package root resolution
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const packageRoot = (() => {
  let current = moduleDir;
  while (true) {
    if (existsSync(path.join(current, 'package.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return moduleDir;
    current = parent;
  }
})();

// Config types
export interface AgentConfig {
  id: string;
  name?: string;
  promptPath?: string;
  model?: string;
  modelReasoningEffort?: string;
  type?: string;
  [key: string]: unknown;
}

export interface ModuleBehaviorConfig {
  type?: string;
  action?: string;
  steps?: number;
  trigger?: string;
  maxIterations?: number;
  skip?: string[];
  [key: string]: unknown;
}

export interface ModuleConfig extends AgentConfig {
  behavior?: ModuleBehaviorConfig;
}

// Config loaders
const require = createRequire(import.meta.url);

export const mainAgents = require(path.resolve(packageRoot, 'config', 'main.agents.js')) as AgentConfig[];
export const moduleCatalog = require(path.resolve(packageRoot, 'config', 'modules.js')) as ModuleConfig[];
