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
  }
}
