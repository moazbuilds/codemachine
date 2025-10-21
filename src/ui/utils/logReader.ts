import { readFileSync, statSync, watch, existsSync } from 'fs';

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
    console.warn(`Cannot watch non-existent file: ${path}`);
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
