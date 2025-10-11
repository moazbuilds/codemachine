import { readFile } from 'node:fs/promises';
import { loadPlaceholdersConfig, resolvePlaceholderPath } from '../config/loader.js';
import { loadPlaceholderContent } from '../content/loader.js';
import { findPlaceholders, getUniquePlaceholderNames } from './parser.js';
import { handlePlaceholderLoadError } from './errors.js';

/**
 * Replaces all placeholders in the prompt with their corresponding content
 *
 * Supports two types of placeholders:
 * - {placeholder_name} - Required placeholder (throws error if file not found)
 * - {!placeholder_name} - Optional placeholder (skips if file not found)
 *
 * @param prompt - The prompt string containing placeholders
 * @param cwd - Current working directory for resolving user-level placeholders
 * @returns The prompt with all placeholders replaced
 * @throws PlaceholderError if a required placeholder cannot be loaded
 */
async function replacePlaceholders(
  prompt: string,
  cwd: string,
): Promise<string> {
  const config = loadPlaceholdersConfig();
  let processedPrompt = prompt;

  // Find all placeholders in the prompt
  const placeholders = findPlaceholders(prompt);
  const uniquePlaceholderNames = getUniquePlaceholderNames(prompt);

  // Load content for each unique placeholder
  for (const placeholderName of uniquePlaceholderNames) {
    // Find if this placeholder is optional by checking the first occurrence
    const firstOccurrence = placeholders.find((p) => p.name === placeholderName);
    const isOptional = firstOccurrence?.isOptional || false;

    // Resolve placeholder path from config
    const resolved = resolvePlaceholderPath(placeholderName, cwd, config);

    if (!resolved) {
      console.warn(
        `Warning: Placeholder {${isOptional ? '!' : ''}${placeholderName}} found in prompt but not defined in config/placeholders.js`
      );
      continue;
    }

    const { filePath, baseDir } = resolved;

    try {
      // Load the placeholder content
      const content = await loadPlaceholderContent(baseDir, filePath);

      // Replace ALL occurrences of this placeholder (with and without !)
      // This handles cases where the same placeholder appears multiple times
      const withOptionalRegex = new RegExp(`\\{!${placeholderName}\\}`, 'g');
      const withoutOptionalRegex = new RegExp(`\\{${placeholderName}\\}`, 'g');

      processedPrompt = processedPrompt.replace(withOptionalRegex, content);
      processedPrompt = processedPrompt.replace(withoutOptionalRegex, content);
    } catch (error) {
      // Handle error based on whether placeholder is optional
      const fallbackContent = handlePlaceholderLoadError(
        placeholderName,
        filePath,
        isOptional,
        error as Error,
      );

      // Replace with fallback content (empty string for optional)
      const withOptionalRegex = new RegExp(`\\{!${placeholderName}\\}`, 'g');
      const withoutOptionalRegex = new RegExp(`\\{${placeholderName}\\}`, 'g');

      processedPrompt = processedPrompt.replace(withOptionalRegex, fallbackContent);
      processedPrompt = processedPrompt.replace(withoutOptionalRegex, fallbackContent);
    }
  }

  return processedPrompt;
}

/**
 * Processes a prompt by loading it from file and replacing all placeholders
 *
 * @param promptPath - Path to the prompt file
 * @param cwd - Current working directory
 * @returns The processed prompt with placeholders replaced
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
 *
 * @param prompt - The prompt string containing placeholders
 * @param cwd - Current working directory
 * @returns The processed prompt with placeholders replaced
 */
export async function processPromptString(
  prompt: string,
  cwd: string,
): Promise<string> {
  return replacePlaceholders(prompt, cwd);
}
