import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Gets the version of CodeMachine.
 *
 * In development mode: Reads from package.json
 * In production/compiled mode: Uses injected VERSION constant
 *
 * This ensures the code works in both `bun run dev` and compiled binaries.
 */

const INJECTED_VERSION: string | undefined =
  // @ts-expect-error - This will be injected by the build script for compiled binaries
  typeof __CODEMACHINE_VERSION__ !== 'undefined'
    // @ts-expect-error - This will be injected by the build script for compiled binaries
    ? __CODEMACHINE_VERSION__
    : undefined;

let cachedVersion: string | null = null;

function getVersionFromPackageJson(): string {
  try {
    // Try to resolve package.json using environment variables first
    const envCandidates = [
      process.env.CODEMACHINE_PACKAGE_JSON,
      process.env.CODEMACHINE_PACKAGE_ROOT
        ? join(process.env.CODEMACHINE_PACKAGE_ROOT, 'package.json')
        : undefined,
      process.env.CODEMACHINE_INSTALL_DIR
        ? join(process.env.CODEMACHINE_INSTALL_DIR, 'package.json')
        : undefined,
    ];

    for (const candidate of envCandidates) {
      if (candidate) {
        try {
          const pkg = JSON.parse(readFileSync(candidate, 'utf8'));
          if (pkg?.version) return pkg.version;
        } catch {
          // Try next candidate
        }
      }
    }

    // Fallback: traverse up from this file location
    let currentDir = join(import.meta.dir || __dirname, '..');
    for (let i = 0; i < 10; i++) {
      const pkgPath = join(currentDir, 'package.json');
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (pkg?.name === 'codemachine' && pkg?.version) {
          return pkg.version;
        }
      } catch {
        // Try parent directory
      }
      const parent = join(currentDir, '..');
      if (parent === currentDir) break;
      currentDir = parent;
    }
    return '0.0.0';
  } catch (error) {
    console.warn('[version] Failed to read version from package.json:', error);
    return '0.0.0-unknown';
  }
}

export function getVersion(): string {
  if (cachedVersion) return cachedVersion;

  // Production: Use injected version (set by build script)
  if (INJECTED_VERSION) {
    cachedVersion = INJECTED_VERSION;
    return cachedVersion;
  }

  // Development: Read from package.json
  cachedVersion = getVersionFromPackageJson();
  return cachedVersion;
}

// Export as constant for backwards compatibility
export const VERSION = getVersion();
