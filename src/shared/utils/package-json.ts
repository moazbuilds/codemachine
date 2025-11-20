import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePackageRoot as resolveRoot } from './package-root.js';

/**
 * Resolves the path to the CodeMachine package.json file.
 *
 * @param moduleUrl - import.meta.url of the calling module
 * @param errorContext - Context string for error messages
 * @returns Absolute path to package.json
 * @throws Error if package.json cannot be located
 */
export function resolvePackageJson(moduleUrl: string, errorContext: string): string {
  const explicitPath = process.env.CODEMACHINE_PACKAGE_JSON;
  if (explicitPath && existsSync(explicitPath)) {
    return explicitPath;
  }

  const root = resolveRoot(moduleUrl, errorContext);
  const rootCandidate = join(root, 'package.json');
  if (existsSync(rootCandidate)) {
    return rootCandidate;
  }

  throw new Error(`Unable to locate package.json from ${errorContext}`);
}

/**
 * Resolves the CodeMachine package root directory.
 * This is a re-export from package-root.ts for backwards compatibility.
 *
 * @param moduleUrl - import.meta.url of the calling module
 * @param errorContext - Context string for error messages
 * @returns Absolute path to package root
 * @throws Error if package root cannot be located
 */
export function resolvePackageRoot(moduleUrl: string, errorContext: string): string {
  return resolveRoot(moduleUrl, errorContext);
}
