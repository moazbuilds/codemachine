import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import { isGlobPattern, matchGlobPattern } from './glob.js';

/**
 * Loads content from a single file
 */
async function loadFileContent(absolutePath: string): Promise<string> {
  try {
    return await readFile(absolutePath, 'utf8');
  } catch (error) {
    throw new Error(
      `Failed to read file ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Loads content from multiple files matching a glob pattern
 * Returns concatenated content with clear markdown separators and file headers
 */
async function loadGlobContent(baseDir: string, pattern: string): Promise<string> {
  const matchedFiles = await matchGlobPattern(baseDir, pattern);

  if (matchedFiles.length === 0) {
    throw new Error(`No files matched the pattern: ${pattern}`);
  }

  // Read all matched files and format with headers and separators
  const formattedContents: string[] = [];
  for (const file of matchedFiles) {
    try {
      const content = await readFile(file, 'utf8');
      const fileName = path.basename(file);
      // Format each file with a header and content
      const formattedContent = `<!-- File: ${fileName} -->\n\n${content.trim()}`;
      formattedContents.push(formattedContent);
    } catch (error) {
      throw new Error(
        `Failed to read file ${file}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Join files with markdown horizontal rule separator
  return formattedContents.join('\n\n---\n\n');
}

/**
 * Loads content for a placeholder
 * Handles both single files and glob patterns
 *
 * @param baseDir - Base directory for resolving relative paths
 * @param filePath - File path or glob pattern (relative or absolute)
 * @returns The file content (or concatenated content for globs)
 * @throws Error if the file(s) cannot be read
 */
export async function loadPlaceholderContent(
  baseDir: string,
  filePath: string,
): Promise<string> {
  // Check if it's a glob pattern
  if (isGlobPattern(filePath)) {
    return loadGlobContent(baseDir, filePath);
  }

  // Single file - resolve to absolute path
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(baseDir, filePath);
  return loadFileContent(absolutePath);
}
