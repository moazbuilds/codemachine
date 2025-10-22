import lockfile from 'proper-lockfile';
import { existsSync } from 'fs';
import * as logger from '../../shared/logging/logger.js';

/**
 * Service for managing file system locks on log files
 * Prevents deletion/modification of log files while agents are running
 */
export class LogLockService {
  private activeLocks: Map<string, () => Promise<void>> = new Map();

  /**
   * Acquire an exclusive lock on a log file
   * Returns a release function to unlock the file
   */
  async acquireLock(filePath: string): Promise<() => Promise<void>> {
    try {
      // Ensure file exists before locking
      if (!existsSync(filePath)) {
        logger.debug(`Cannot lock non-existent file: ${filePath}`);
        // Return no-op release function for graceful degradation
        return async () => {};
      }

      // Acquire lock with proper-lockfile
      const release = await lockfile.lock(filePath, {
        stale: 30000, // 30 second stale timeout to prevent deadlocks
        retries: {
          retries: 3,
          minTimeout: 100,
          maxTimeout: 500,
        },
      });

      // Store release function
      this.activeLocks.set(filePath, release);
      logger.debug(`Acquired lock for ${filePath}`);

      return release;
    } catch (error) {
      logger.debug(`Failed to acquire lock for ${filePath}: ${error}`);
      // Return no-op release function for graceful degradation
      // This allows the system to continue even if locking fails
      return async () => {};
    }
  }

  /**
   * Release lock on a specific file
   */
  async releaseLock(filePath: string): Promise<void> {
    const release = this.activeLocks.get(filePath);
    if (release) {
      try {
        await release();
        this.activeLocks.delete(filePath);
        logger.debug(`Released lock for ${filePath}`);
      } catch (error) {
        logger.debug(`Failed to release lock for ${filePath}: ${error}`);
        // Still remove from map even if release failed
        this.activeLocks.delete(filePath);
      }
    }
  }

  /**
   * Release all active locks
   * Used during cleanup/shutdown
   */
  async releaseAllLocks(): Promise<void> {
    const releases = Array.from(this.activeLocks.entries());

    for (const [path, release] of releases) {
      try {
        await release();
        logger.debug(`Released lock for ${path}`);
      } catch (error) {
        logger.debug(`Failed to release lock for ${path}: ${error}`);
      }
    }

    this.activeLocks.clear();
  }

  /**
   * Check if a file is currently locked
   */
  isLocked(filePath: string): boolean {
    return this.activeLocks.has(filePath);
  }

  /**
   * Get count of active locks
   */
  getActiveLockCount(): number {
    return this.activeLocks.size;
  }
}
