import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import type { MemoryEntry } from '../../agents/index.js';

export type MemoryAnalyticsSource = 'adapter' | 'store';

export interface MemoryAppendAnalyticsPayload {
  agentId: string;
  entry: MemoryEntry;
  source: MemoryAnalyticsSource;
}

export interface MemoryReadAnalyticsPayload {
  agentId: string;
  entries: MemoryEntry[];
  source: MemoryAnalyticsSource;
}

export interface MemoryAnalyticsHooks {
  onAppend?: (payload: MemoryAppendAnalyticsPayload) => void;
  onRead?: (payload: MemoryReadAnalyticsPayload) => void;
}

export class MemoryAdapter {
  public readonly baseDir: string;
  public readonly analytics?: MemoryAnalyticsHooks;

  constructor(baseDir: string, hooks?: MemoryAnalyticsHooks) {
    this.baseDir = baseDir;
    this.analytics = hooks;
  }

  async append(entry: MemoryEntry): Promise<void> {
    await this.ensureBaseDir();
    const filePath = this.agentFilePath(entry.agentId);
    const entries = await this.readEntriesFromFile(filePath);
    entries.push(entry);
    await fs.writeFile(filePath, JSON.stringify(entries, null, 2), 'utf-8');
    this.analytics?.onAppend?.({ agentId: entry.agentId, entry, source: 'adapter' });
  }

  async read(agentId: string): Promise<MemoryEntry[]> {
    await this.ensureBaseDir();
    const filePath = this.agentFilePath(agentId);
    const entries = await this.readEntriesFromFile(filePath);
    this.analytics?.onRead?.({ agentId, entries, source: 'adapter' });
    return entries;
  }

  async readAll(): Promise<Record<string, MemoryEntry[]>> {
    await this.ensureBaseDir();
    const files = await fs.readdir(this.baseDir).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        return [] as string[];
      }
      throw error;
    });

    const result: Record<string, MemoryEntry[]> = {};
    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }
      const agentId = file.replace(/\.json$/, '');
      const entries = await this.readEntriesFromFile(join(this.baseDir, file));
      result[agentId] = entries;
      this.analytics?.onRead?.({ agentId, entries, source: 'adapter' });
    }

    return result;
  }

  private async ensureBaseDir(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  private agentFilePath(agentId: string): string {
    const sanitized = this.sanitizeAgentId(agentId);
    return join(this.baseDir, `${sanitized}.json`);
  }

  private sanitizeAgentId(agentId: string): string {
    return agentId.toLowerCase().replace(/[^A-Za-z0-9_-]+/g, '-');
  }

  private async readEntriesFromFile(filePath: string): Promise<MemoryEntry[]> {
    const data = await fs.readFile(filePath, 'utf-8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        return '[]';
      }
      throw error;
    });

    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed as MemoryEntry[];
      }
      return [];
    } catch (_error) {
      return [];
    }
  }
}
