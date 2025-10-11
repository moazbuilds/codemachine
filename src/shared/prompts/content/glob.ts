import * as path from 'node:path';
import { readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';

/**
 * Checks if a path contains glob patterns
 */
export function isGlobPattern(filePath: string): boolean {
  return filePath.includes('*') || filePath.includes('?') || filePath.includes('[');
}

/**
 * Matches files against a glob pattern
 * Returns an array of absolute file paths sorted alphabetically
 */
export async function matchGlobPattern(
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
