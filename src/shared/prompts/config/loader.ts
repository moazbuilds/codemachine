import * as path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { PlaceholdersConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

/**
 * Finds the codemachine package root by looking for package.json
 */
export function findPackageRoot(): string | null {
  let current = __dirname;
  const limit = 10;

  for (let i = 0; i < limit; i++) {
    const packageJson = path.join(current, 'package.json');
    if (existsSync(packageJson)) {
      try {
        const pkg = require(packageJson);
        if (pkg?.name === 'codemachine') {
          return current;
        }
      } catch {
        // Continue searching
      }
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

/**
 * Loads the prompt placeholders configuration
 */
export function loadPlaceholdersConfig(): PlaceholdersConfig {
  try {
    const packageRoot = findPackageRoot();
    if (!packageRoot) {
      console.warn('Warning: Could not find codemachine package root');
      return {};
    }

    const configPath = path.join(packageRoot, 'config', 'placeholders.js');

    if (!existsSync(configPath)) {
      console.warn(`Warning: Placeholder config not found at ${configPath}`);
      return {};
    }

    // Clear cache to allow dynamic reloading
    try {
      delete require.cache[require.resolve(configPath)];
    } catch {
      // Ignore if not in cache
    }

    const config = require(configPath);

    // Support both old format (flat) and new format (userDir/packageDir)
    if (config.userDir || config.packageDir) {
      return config as PlaceholdersConfig;
    } else {
      // Backwards compatibility: treat flat config as userDir
      return { userDir: config };
    }
  } catch (error) {
    console.warn(`Warning: Failed to load placeholder config: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

/**
 * Resolves a placeholder name to its file path and base directory
 * Returns null if the placeholder is not defined in the config
 */
export function resolvePlaceholderPath(
  placeholderName: string,
  cwd: string,
  config?: PlaceholdersConfig
): { filePath: string; baseDir: string } | null {
  const loadedConfig = config || loadPlaceholdersConfig();
  const packageRoot = findPackageRoot();

  // Check userDir first, then packageDir
  if (loadedConfig.userDir && loadedConfig.userDir[placeholderName]) {
    return {
      filePath: loadedConfig.userDir[placeholderName],
      baseDir: cwd,
    };
  }

  if (loadedConfig.packageDir && loadedConfig.packageDir[placeholderName]) {
    return {
      filePath: loadedConfig.packageDir[placeholderName],
      baseDir: packageRoot || cwd,
    };
  }

  return null;
}
