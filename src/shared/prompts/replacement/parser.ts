import type { PlaceholderMatch } from '../config/types.js';

/**
 * Regular expression to match placeholders in the format:
 * - {placeholder_name} - Required placeholder
 * - {!placeholder_name} - Optional placeholder (won't throw error if missing)
 */
export const PLACEHOLDER_PATTERN = /\{(!)?([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

/**
 * Parses a placeholder match into structured data
 *
 * @param match - RegExp match array from PLACEHOLDER_PATTERN
 * @returns Parsed placeholder information
 */
export function parsePlaceholder(match: RegExpMatchArray): PlaceholderMatch {
  const fullMatch = match[0]; // e.g., "{!plan_fallback}" or "{architecture}"
  const optionalPrefix = match[1]; // "!" if present, undefined otherwise
  const name = match[2]; // e.g., "plan_fallback" or "architecture"

  return {
    fullMatch,
    isOptional: optionalPrefix === '!',
    name,
  };
}

/**
 * Finds all placeholders in a prompt string
 *
 * @param prompt - The prompt string to parse
 * @returns Array of parsed placeholder matches
 */
export function findPlaceholders(prompt: string): PlaceholderMatch[] {
  const matches = Array.from(prompt.matchAll(PLACEHOLDER_PATTERN));
  return matches.map(parsePlaceholder);
}

/**
 * Gets unique placeholder names from the prompt
 *
 * @param prompt - The prompt string to parse
 * @returns Set of unique placeholder names
 */
export function getUniquePlaceholderNames(prompt: string): Set<string> {
  const placeholders = findPlaceholders(prompt);
  return new Set(placeholders.map((p) => p.name));
}
