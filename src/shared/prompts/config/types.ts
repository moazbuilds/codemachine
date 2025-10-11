/**
 * Shared type definitions for placeholder processing
 */

/**
 * Configuration for placeholders from config/placeholders.js
 */
export type PlaceholdersConfig = {
  userDir?: Record<string, string>;
  packageDir?: Record<string, string>;
};

/**
 * Represents a parsed placeholder from the prompt
 */
export interface PlaceholderMatch {
  /** The full match string including braces (e.g., "{!plan_fallback}") */
  fullMatch: string;
  /** Whether the placeholder is optional (prefixed with !) */
  isOptional: boolean;
  /** The placeholder name without prefix or braces (e.g., "plan_fallback") */
  name: string;
}

/**
 * Resolved placeholder information with file path
 */
export interface ResolvedPlaceholder extends PlaceholderMatch {
  /** The resolved file path */
  filePath: string;
  /** The base directory for resolving relative paths */
  baseDir: string;
}
