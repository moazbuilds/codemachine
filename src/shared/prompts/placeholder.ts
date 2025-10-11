import * as path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

/**
 * Finds the codemachine package root by looking for package.json
 */
function findPackageRoot(): string | null {
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

type PlaceholdersConfig = {
  userDir?: Record<string, string>;
  packageDir?: Record<string, string>;
};

/**
 * Loads the prompt placeholders configuration
 */
function loadPlaceholdersConfig(): PlaceholdersConfig {
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
 * Checks if a path contains glob patterns
 */
function isGlobPattern(filePath: string): boolean {
  return filePath.includes('*') || filePath.includes('?') || filePath.includes('[');
}

/**
 * Matches files against a glob pattern
 */
async function matchGlobPattern(
  baseDir: string,
  pattern: string,
): Promise<string[]> {
  const absolutePattern = path.isAbsolute(pattern) ? pattern : path.resolve(baseDir, pattern);
  const directory = path.dirname(absolutePattern);
  const filePattern = path.basename(absolutePattern);

  if (!existsSync(directory)) {
    return [];
  }

  try {
    const files = await readdir(directory);
    const matchedFiles: string[] = [];

    for (const file of files) {
      const fullPath = path.join(directory, file);

      // Check if it's a file (not directory)
      try {
        const stats = statSync(fullPath);
        if (!stats.isFile()) continue;
      } catch {
        continue;
      }

      // Simple pattern matching for *.ext patterns
      if (filePattern.startsWith('*')) {
        const extension = filePattern.substring(1); // e.g., ".md"
        if (file.endsWith(extension)) {
          matchedFiles.push(fullPath);
        }
      } else if (filePattern === file) {
        matchedFiles.push(fullPath);
      }
    }

    // Sort alphabetically (a-z)
    return matchedFiles.sort((a, b) => {
      const nameA = path.basename(a).toLowerCase();
      const nameB = path.basename(b).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  } catch (error) {
    throw new Error(
      `Failed to match glob pattern ${pattern}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Loads content for a single placeholder
 */
async function loadPlaceholderContent(
  cwd: string,
  filePath: string,
): Promise<string> {
  // Check if it's a glob pattern
  if (isGlobPattern(filePath)) {
    const matchedFiles = await matchGlobPattern(cwd, filePath);

    if (matchedFiles.length === 0) {
      throw new Error(`No files matched the pattern: ${filePath}`);
    }

    // Read all matched files and concatenate with <br>
    const contents: string[] = [];
    for (const file of matchedFiles) {
      try {
        const content = await readFile(file, 'utf8');
        contents.push(content);
      } catch (error) {
        throw new Error(
          `Failed to read file ${file}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return contents.join('<br>');
  }

  // Original behavior for single files
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);

  try {
    return await readFile(absolutePath, 'utf8');
  } catch (error) {
    throw new Error(
      `Failed to load placeholder content from ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Replaces all placeholders in the prompt with their corresponding content
 */
async function replacePlaceholders(
  prompt: string,
  cwd: string,
): Promise<string> {
  const config = loadPlaceholdersConfig();
  const packageRoot = findPackageRoot();
  let processedPrompt = prompt;

  // Find all placeholders in the format {placeholder_name}
  const placeholderPattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  const matches = Array.from(prompt.matchAll(placeholderPattern));

  // Load content for each unique placeholder
  const uniquePlaceholders = new Set(matches.map((m) => m[1]));

  for (const placeholderName of uniquePlaceholders) {
    // Check userDir first, then packageDir
    let filePath: string | undefined;
    let baseDir: string | undefined;

    if (config.userDir && config.userDir[placeholderName]) {
      filePath = config.userDir[placeholderName];
      baseDir = cwd;
    } else if (config.packageDir && config.packageDir[placeholderName]) {
      filePath = config.packageDir[placeholderName];
      baseDir = packageRoot || cwd;
    }

    if (!filePath || !baseDir) {
      console.warn(
        `Warning: Placeholder {${placeholderName}} found in prompt but not defined in config/placeholders.js`
      );
      continue;
    }

    try {
      const content = await loadPlaceholderContent(baseDir, filePath);
      const placeholderRegex = new RegExp(`\\{${placeholderName}\\}`, 'g');
      processedPrompt = processedPrompt.replace(placeholderRegex, content);
    } catch (error) {
      throw new Error(
        `Failed to process placeholder {${placeholderName}}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return processedPrompt;
}

/**
 * Processes a prompt by loading it from file and replacing all placeholders
 */
export async function processPrompt(
  promptPath: string,
  cwd: string,
): Promise<string> {
  // Load the prompt file
  const prompt = await readFile(promptPath, 'utf8');

  // Replace all placeholders
  return replacePlaceholders(prompt, cwd);
}

/**
 * Processes a prompt string (already loaded) by replacing all placeholders
 */
export async function processPromptString(
  prompt: string,
  cwd: string,
): Promise<string> {
  return replacePlaceholders(prompt, cwd);
}
