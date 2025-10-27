import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { AgentRecord, AgentRegistryData } from './types.js';
import * as logger from '../../shared/logging/logger.js';

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

  constructor(registryPath: string = '.codemachine/logs/registry.json') {
    this.registryPath = registryPath;
    this.data = this.load();
  }

  /**
   * Reload data from disk (for multi-process safety)
   * Synchronous for backwards compatibility, reads from cache immediately
   */
  reload(): void {
    this.data = this.load();
    // Also trigger async reload in background to refresh cache
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
        const parsed = JSON.parse(content) as AgentRegistryData;
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
        const parsed = JSON.parse(content) as AgentRegistryData;
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
   * Writes immediately to prevent ID conflicts across processes
   */
  getNextId(): number {
    this.data.lastId += 1;
    this.persistImmediate();
    return this.data.lastId;
  }

  /**
   * Save agent record
   * Critical operations (initial registration) are written immediately
   * to prevent timing issues with UI loading logs
   */
  save(agent: AgentRecord): void {
    this.data.agents[agent.id] = agent;

    // For initial agent registration (no endTime), write immediately
    // This prevents "Agent not found" errors when UI loads logs right after registration
    if (!agent.endTime) {
      this.persistImmediate();
    } else {
      this.persist();
    }
  }

  /**
   * Persist immediately without debouncing (for critical operations)
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
   * Reloads from disk first to prevent multi-process conflicts
   */
  update(id: number, updates: Partial<AgentRecord>): void {
    // Reload from disk to get latest state (critical for multi-process safety)
    // This prevents subprocess changes (e.g., children array updates) from being lost
    this.data = this.load();

    const agent = this.data.agents[id];
    if (agent) {
      this.data.agents[id] = { ...agent, ...updates };
      this.persist();
    }
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
  }
}
