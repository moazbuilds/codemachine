import lockfile from 'proper-lockfile';
import * as logger from '../../shared/logging/logger.js';

/**
 * Service for managing file system lock on the agent registry
 * Prevents race conditions when multiple processes access registry.json simultaneously
 *
 * Uses proper-lockfile for cross-process locking with:
 * - Stale lock detection (30s timeout)
 * - Automatic retry with exponential backoff
 * - Graceful degradation on lock failures
 */
export class RegistryLockService {
  private registryPath: string;
  private activeLock: (() => Promise<void>) | null = null;

  constructor(registryPath: string) {
    this.registryPath = registryPath;
  }

  /**
   * Acquire an exclusive lock on the registry file
   * Returns a release function to unlock the file
   *
   * Ensures the file exists before attempting to lock
   */
  async acquireLock(): Promise<() => Promise<void>> {
    try {
      const lockPath = this.registryPath;

      // Ensure file exists before locking (proper-lockfile requires this)
      // Create empty file if it doesn't exist
      const { existsSync } = await import('fs');
      const { writeFile, mkdir } = await import('fs/promises');
      const { dirname } = await import('path');

      if (!existsSync(lockPath)) {
        const dir = dirname(lockPath);
        if (!existsSync(dir)) {
          await mkdir(dir, { recursive: true });
        }
        // Create minimal valid registry file
        await writeFile(lockPath, JSON.stringify({ lastId: 0, agents: {} }, null, 2), 'utf-8');
        logger.debug(`Created registry file for locking: ${lockPath}`);
      }

      // Acquire lock with proper-lockfile
      const release = await lockfile.lock(lockPath, {
        stale: 30000, // 30 second stale timeout to prevent deadlocks
        retries: {
          retries: 5, // More retries for registry (higher contention)
          minTimeout: 50,
          maxTimeout: 500,
        },
        realpath: false, // Don't resolve symlinks
        lockfilePath: `${lockPath}.lock`, // Explicit lock file path
      });

      this.activeLock = release;
      logger.debug(`Acquired lock for registry: ${this.registryPath}`);

      return release;
    } catch (error) {
      logger.error(`CRITICAL: Failed to acquire lock for registry ${this.registryPath}: ${error}`);
      // DO NOT silently degrade - throw error for critical operations
      // This prevents data corruption from unprotected concurrent access
      throw new Error(`Failed to acquire registry lock: ${error}`);
    }
  }

  /**
   * Release the registry lock
   */
  async releaseLock(): Promise<void> {
    if (this.activeLock) {
      try {
        await this.activeLock();
        this.activeLock = null;
        logger.debug(`Released lock for registry: ${this.registryPath}`);
      } catch (error) {
        logger.warn(`Failed to release lock for registry ${this.registryPath}: ${error}`);
        // Still clear the lock reference
        this.activeLock = null;
      }
    }
  }

  /**
   * Execute a function with registry lock held
   * Automatically acquires and releases the lock
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquireLock();
    try {
      return await fn();
    } finally {
      await release();
    }
  }

  /**
   * Check if the registry is currently locked by this instance
   */
  isLocked(): boolean {
    return this.activeLock !== null;
  }
}
