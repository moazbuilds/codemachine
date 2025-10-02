import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Loads the prompt placeholders configuration
 */
function loadPlaceholdersConfig(projectRoot: string): Record<string, string> {
  try {
    const configPath = path.join(projectRoot, 'config', 'prompt-placeholders.js');
    // Clear cache to allow dynamic reloading
    delete require.cache[require.resolve(configPath)];
    return require(configPath);
  } catch (error) {
    // If config doesn't exist, return empty object
    return {};
  }
}

/**
 * Loads content for a single placeholder
 */
async function loadPlaceholderContent(
  cwd: string,
  filePath: string,
): Promise<string> {
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
  projectRoot: string,
): Promise<string> {
  const config = loadPlaceholdersConfig(projectRoot);
  let processedPrompt = prompt;

  // Find all placeholders in the format {placeholder_name}
  const placeholderPattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  const matches = Array.from(prompt.matchAll(placeholderPattern));

  // Load content for each unique placeholder
  const uniquePlaceholders = new Set(matches.map((m) => m[1]));

  for (const placeholderName of uniquePlaceholders) {
    const filePath = config[placeholderName];

    if (!filePath) {
      console.warn(
        `Warning: Placeholder {${placeholderName}} found in prompt but not defined in config/prompt-placeholders.js`
      );
      continue;
    }

    try {
      const content = await loadPlaceholderContent(cwd, filePath);
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
  projectRoot?: string,
): Promise<string> {
  const resolvedProjectRoot = projectRoot || cwd;

  // Load the prompt file
  const prompt = await readFile(promptPath, 'utf8');

  // Replace all placeholders
  return replacePlaceholders(prompt, cwd, resolvedProjectRoot);
}

/**
 * Processes a prompt string (already loaded) by replacing all placeholders
 */
export async function processPromptString(
  prompt: string,
  cwd: string,
  projectRoot?: string,
): Promise<string> {
  const resolvedProjectRoot = projectRoot || cwd;
  return replacePlaceholders(prompt, cwd, resolvedProjectRoot);
}
