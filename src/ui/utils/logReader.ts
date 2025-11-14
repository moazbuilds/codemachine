import { readFileSync, statSync, watch, existsSync, createReadStream } from 'fs';
import { warn } from '../../shared/logging/logger.js';

/**
 * Read log file and return array of lines
 */
export async function readLogFile(path: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    try {
      if (!existsSync(path)) {
        reject(new Error(`Log file not found: ${path}`));
        return;
      }

      const content = readFileSync(path, 'utf-8');
      const lines = content.split('\n');
      resolve(lines);
    } catch (error) {
      reject(new Error(`Failed to read log: ${error}`));
    }
  });
}

/**
 * Incremental log reader that tracks file position
 * Only reads new content since last read (90% faster for large files)
 */
export class IncrementalLogReader {
  private lastPosition: number = 0;
  private path: string;

  constructor(path: string) {
    this.path = path;
  }

  /**
   * Read only new lines since last read
   * Returns {lines, hasNewContent}
   */
  async readNewLines(): Promise<{ lines: string[]; hasNewContent: boolean }> {
    try {
      if (!existsSync(this.path)) {
        return { lines: [], hasNewContent: false };
      }

      const currentSize = statSync(this.path).size;

      // No new content
      if (currentSize <= this.lastPosition) {
        return { lines: [], hasNewContent: false };
      }

      // Read only new bytes
      const newContent = await this.readFromPosition(this.lastPosition, currentSize);
      this.lastPosition = currentSize;

      const newLines = newContent.split('\n').filter(line => line.length > 0);
      return {
        lines: newLines,
        hasNewContent: newLines.length > 0
      };
    } catch (_error) {
      return { lines: [], hasNewContent: false };
    }
  }

  /**
   * Read file content from start position to end position
   */
  private async readFromPosition(start: number, end: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: string[] = [];

      const stream = createReadStream(this.path, {
        encoding: 'utf-8',
        start,
        end: end - 1 // end is inclusive
      });

      stream.on('data', (chunk: string | Buffer) => {
        chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
      });

      stream.on('end', () => {
        resolve(chunks.join(''));
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Reset position to re-read entire file
   */
  reset(): void {
    this.lastPosition = 0;
  }

  /**
   * Get current read position
   */
  getPosition(): number {
    return this.lastPosition;
  }
}

/**
 * Get file size in bytes
 */
export function getFileSize(path: string): number {
  try {
    if (!existsSync(path)) {
      return 0;
    }
    return statSync(path).size;
  } catch {
    return 0;
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Watch log file for changes and call callback with updated lines
 * Returns cleanup function to stop watching
 */
export function watchLogFile(
  path: string,
  callback: (lines: string[]) => void
): () => void {
  if (!existsSync(path)) {
    warn(`Cannot watch non-existent file: ${path}`);
    return () => {}; // Return no-op cleanup
  }

  let debounceTimer: NodeJS.Timeout | null = null;

  const watcher = watch(path, { persistent: false }, () => {
    // Debounce updates to avoid excessive re-renders
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      try {
        const lines = await readLogFile(path);
        callback(lines);
      } catch (_error) {
        // Silently ignore watch errors (file might be temporarily locked)
      }
    }, 100); // 100ms debounce
  });

  // Cleanup function
  return () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    watcher.close();
  };
}
