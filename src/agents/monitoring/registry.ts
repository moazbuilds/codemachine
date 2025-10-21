import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import type { AgentRecord, AgentRegistryData } from './types.js';
import * as logger from '../../shared/logging/logger.js';

/**
 * Manages persistence of agent registry to disk
 * Stores agent metadata in .codemachine/logs/registry.json
 */
export class AgentRegistry {
  private registryPath: string;
  private data: AgentRegistryData;

  constructor(registryPath: string = '.codemachine/logs/registry.json') {
    this.registryPath = registryPath;
    this.data = this.load();
  }

  /**
   * Reload data from disk (for multi-process safety)
   */
  reload(): void {
    this.data = this.load();
  }

  /**
   * Load registry from disk, or create new if doesn't exist
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
   * Persist registry to disk
   */
  private persist(): void {
    try {
      // Ensure directory exists
      const dir = dirname(this.registryPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(this.registryPath, JSON.stringify(this.data, null, 2), 'utf-8');
      logger.debug(`Persisted agent registry to ${this.registryPath}`);
    } catch (error) {
      logger.error(`Failed to persist agent registry: ${error}`);
    }
  }

  /**
   * Get next available agent ID
   */
  getNextId(): number {
    this.data.lastId += 1;
    this.persist();
    return this.data.lastId;
  }

  /**
   * Save agent record
   */
  save(agent: AgentRecord): void {
    this.data.agents[agent.id] = agent;
    this.persist();
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
