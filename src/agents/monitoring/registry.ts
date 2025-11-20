<<<<<<< HEAD
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { readFile, writeFile, mkdir, rename } from 'fs/promises';
import { dirname } from 'path';
import type { AgentRecord, AgentRegistryData } from './types.js';
import * as logger from '../../shared/logging/logger.js';
import { RegistryLockService } from './registryLock.js';

/**
 * Manages persistence of agent registry to disk with async I/O and write debouncing
 * Stores agent metadata in .codemachine/logs/registry.json
 *
 * Performance optimizations:
 * - In-memory cache eliminates blocking disk reads
 * - Async writes prevent main thread blocking
 * - Debounced writes batch multiple updates together
 */
export class AgentRegistry {
  private registryPath: string;
  private data: AgentRegistryData;
  private isDirty: boolean = false;
  private pendingWrite: NodeJS.Timeout | null = null;
  private writeDebounceMs: number = 100; // Batch writes within 100ms
  private lockService: RegistryLockService;

  constructor(registryPath: string = '.codemachine/logs/registry.json') {
    this.registryPath = registryPath;
    this.lockService = new RegistryLockService(registryPath);
    this.data = this.load();
  }

  /**
   * Reload data from disk (for multi-process safety)
   * Non-blocking: reads from cache immediately, refreshes asynchronously in background
   */
  reload(): void {
    // Don't block - just trigger async reload in background
    // Reads from in-memory cache (this.data) immediately
    this.reloadAsync().catch(err => logger.warn(`Background reload failed: ${err}`));
  }

  /**
   * Async reload from disk (non-blocking)
   * Updates in-memory cache without blocking
   */
  private async reloadAsync(): Promise<void> {
    try {
      if (existsSync(this.registryPath)) {
        const content = await readFile(this.registryPath, 'utf-8');

        // Skip empty or whitespace-only files (race condition during file creation)
        if (!content || content.trim().length === 0) {
          logger.debug('Registry file is empty, skipping reload');
          return;
        }

        const parsed = JSON.parse(content) as AgentRegistryData;

        // Validate parsed data structure
        if (!parsed || typeof parsed !== 'object' || !parsed.agents) {
          logger.warn('Registry file has invalid structure, skipping reload');
          return;
        }

        this.data = parsed;
        logger.debug(`Async reloaded agent registry with ${Object.keys(parsed.agents).length} agents`);
      }
    } catch (error) {
      logger.warn(`Failed to async reload agent registry: ${error}`);
    }
  }

  /**
   * Load registry from disk (synchronous fallback for initialization)
   * Only used in constructor - all other reads use in-memory cache
   */
  private load(): AgentRegistryData {
    try {
      if (existsSync(this.registryPath)) {
        const content = readFileSync(this.registryPath, 'utf-8');

        // Skip empty or whitespace-only files (race condition during file creation)
        if (!content || content.trim().length === 0) {
          logger.debug('Registry file is empty, returning default registry');
          return { lastId: 0, agents: {} };
        }

        const parsed = JSON.parse(content) as AgentRegistryData;

        // Validate parsed data structure
        if (!parsed || typeof parsed !== 'object' || !parsed.agents) {
          logger.warn('Registry file has invalid structure, returning default registry');
          return { lastId: 0, agents: {} };
        }

        logger.debug(`Loaded agent registry with ${Object.keys(parsed.agents).length} agents`);
        return parsed;
      }
    } catch (error) {
      logger.warn(`Failed to load agent registry: ${error}`);
    }

    // Return empty registry
    return {
      lastId: 0,
      agents: {}
    };
  }

  /**
   * Persist registry to disk (debounced, async, non-blocking)
   * Multiple calls within 100ms are batched together
   */
  private persist(): void {
    this.isDirty = true;

    // Cancel any pending write
    if (this.pendingWrite) {
      clearTimeout(this.pendingWrite);
    }

    // Schedule debounced write
    this.pendingWrite = setTimeout(() => {
      this.persistAsync().catch(err => logger.error(`Async persist failed: ${err}`));
    }, this.writeDebounceMs);
  }

  /**
   * Immediately flush any pending writes (for cleanup/shutdown)
   */
  async flush(): Promise<void> {
    if (this.pendingWrite) {
      clearTimeout(this.pendingWrite);
      this.pendingWrite = null;
    }
    if (this.isDirty) {
      await this.persistAsync();
    }
  }

  /**
   * Async persist to disk (non-blocking)
   */
  private async persistAsync(): Promise<void> {
    if (!this.isDirty) {
      return;
    }

    try {
      // Ensure directory exists
      const dir = dirname(this.registryPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      await writeFile(this.registryPath, JSON.stringify(this.data, null, 2), 'utf-8');
      this.isDirty = false;
      logger.debug(`Async persisted agent registry to ${this.registryPath}`);
    } catch (error) {
      logger.error(`Failed to async persist agent registry: ${error}`);
    }
  }

  /**
   * Get next available agent ID
   * Uses file locking to prevent ID conflicts across processes
   */
  async getNextId(): Promise<number> {
    return await this.lockService.withLock(async () => {
      // Reload from disk to get latest ID (critical for multi-process)
      this.data = this.load();
      this.data.lastId += 1;
      await this.persistImmediateAtomic();
      return this.data.lastId;
    });
  }

  /**
   * Save agent record
   * Critical operations (initial registration) are written immediately with locking
   * to prevent timing issues and race conditions
   */
  async save(agent: AgentRecord): Promise<void> {
    // For initial agent registration (no endTime), write immediately with lock
    // This prevents "Agent not found" errors and race conditions
    if (!agent.endTime) {
      await this.lockService.withLock(async () => {
        // Reload to get latest state before saving
        this.data = this.load();
        this.data.agents[agent.id] = agent;
        await this.persistImmediateAtomic();
      });
    } else {
      // For updates (has endTime), use in-memory cache and debounced write
      this.data.agents[agent.id] = agent;
      this.persist();
    }
  }

  /**
   * Persist immediately without debouncing (for critical operations)
   * DEPRECATED: Use persistImmediateAtomic() instead
   */
  private persistImmediate(): void {
    // Cancel any pending debounced write
    if (this.pendingWrite) {
      clearTimeout(this.pendingWrite);
      this.pendingWrite = null;
    }

    // Write synchronously for immediate availability
    try {
      const dir = dirname(this.registryPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(this.registryPath, JSON.stringify(this.data, null, 2), 'utf-8');
      this.isDirty = false;
      logger.debug(`Immediately persisted agent registry to ${this.registryPath}`);
    } catch (error) {
      logger.error(`Failed to immediately persist agent registry: ${error}`);
    }
  }

  /**
   * Persist immediately with atomic write (for critical operations under lock)
   * Uses temp file + rename pattern for crash safety
   */
  private async persistImmediateAtomic(): Promise<void> {
    // Cancel any pending debounced write
    if (this.pendingWrite) {
      clearTimeout(this.pendingWrite);
      this.pendingWrite = null;
    }

    try {
      const dir = dirname(this.registryPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      // Write to temp file first
      const tempPath = `${this.registryPath}.tmp`;
      await writeFile(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');

      // Atomic rename (POSIX guarantees atomicity)
      await rename(tempPath, this.registryPath);

      this.isDirty = false;
      logger.debug(`Atomically persisted agent registry to ${this.registryPath}`);
    } catch (error) {
      logger.error(`Failed to atomically persist agent registry: ${error}`);
      throw error; // Re-throw for lock handler
    }
  }

  /**
   * Get agent by ID
   */
  get(id: number): AgentRecord | undefined {
    return this.data.agents[id];
  }

  /**
   * Get all agents
   */
  getAll(): AgentRecord[] {
    return Object.values(this.data.agents);
  }

  /**
   * Update specific fields of an agent
   * Uses file locking to prevent multi-process conflicts
   */
  async update(id: number, updates: Partial<AgentRecord>): Promise<void> {
    await this.lockService.withLock(async () => {
      // Reload from disk to get latest state (critical for multi-process safety)
      // This prevents subprocess changes (e.g., children array updates) from being lost
      this.data = this.load();

      const agent = this.data.agents[id];
      if (agent) {
        this.data.agents[id] = { ...agent, ...updates };
        await this.persistImmediateAtomic();
      }
    });
  }

  /**
   * Delete agent record (for cleanup/retention policies)
   */
  delete(id: number): void {
    delete this.data.agents[id];
    this.persist();
  }

  /**
   * Get all active (running) agents
   */
  getActive(): AgentRecord[] {
    return this.getAll().filter(agent => agent.status === 'running');
  }

  /**
   * Get all offline (completed/failed) agents
   */
  getOffline(): AgentRecord[] {
    return this.getAll().filter(agent => agent.status !== 'running');
  }

  /**
   * Get children of a specific agent
   */
  getChildren(parentId: number): AgentRecord[] {
    return this.getAll().filter(agent => agent.parentId === parentId);
=======
import { getDB } from './db/connection.js';
import { AgentRepository } from './db/repository.js';
import type { AgentRecord } from './types.js';
import * as logger from '../../shared/logging/logger.js';

/**
 * Agent Registry - SQLite backend
 * NO JSON. NO LOCKS. JUST DB.
 */
export class AgentRegistry {
  private repository: AgentRepository;

  constructor() {
    const db = getDB();
    this.repository = new AgentRepository(db);
    logger.debug('AgentRegistry initialized (SQLite)');
  }

  async getNextId(): Promise<number> {
    return this.repository.getMaxId() + 1;
  }

  async save(agent: AgentRecord): Promise<void> {
    if (agent.endTime) {
      this.repository.update(agent.id, {
        status: agent.status,
        endTime: agent.endTime,
        duration: agent.duration,
        telemetry: agent.telemetry,
        error: agent.error,
      });
    }
  }

  get(id: number): AgentRecord | undefined {
    return this.repository.get(id);
  }

  getAll(): AgentRecord[] {
    return this.repository.getAll();
  }

  async update(id: number, updates: Partial<AgentRecord>): Promise<void> {
    this.repository.update(id, updates);
  }

  delete(id: number): void {
    this.repository.delete(id);
  }

  getChildren(parentId: number): AgentRecord[] {
    return this.repository.getChildren(parentId);
  }

  reload(): void {
    // NO-OP: DB is always current
  }

  async flush(): Promise<void> {
    // NO-OP: No debouncing
>>>>>>> origin/main
  }
}
