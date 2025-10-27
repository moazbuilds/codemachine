import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, createReadStream } from 'fs';
import { dirname } from 'path';
import type { WriteStream } from 'fs';
import * as logger from '../../shared/logging/logger.js';
import { AgentMonitorService } from './monitor.js';
import { LogLockService } from './logLock.js';

/**
 * Manages log file I/O for agents
 * Creates individual log files and provides streaming interfaces
 */
export class AgentLoggerService {
  private static instance: AgentLoggerService;
  private activeStreams: Map<number, WriteStream> = new Map();
  private lockService: LogLockService = new LogLockService();

  private constructor() {
    logger.debug('AgentLoggerService initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentLoggerService {
    if (!AgentLoggerService.instance) {
      AgentLoggerService.instance = new AgentLoggerService();
    }
    return AgentLoggerService.instance;
  }

  /**
   * Create a write stream for an agent's log file
   * Returns a stream that can be written to immediately
   * Acquires file lock asynchronously in background
   */
  createStream(agentId: number): WriteStream {
    const monitor = AgentMonitorService.getInstance();
    const agent = monitor.getAgent(agentId);

    if (!agent) {
      throw new Error(`Cannot create log stream for non-existent agent ${agentId}`);
    }

    // Ensure log directory exists
    const logDir = dirname(agent.logPath);
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    // Create write stream immediately
    const stream = createWriteStream(agent.logPath, { flags: 'a', encoding: 'utf-8' });
    this.activeStreams.set(agentId, stream);

    // Write header with truncated prompt (full prompt only in debug mode)
    const isDebugMode = process.env.DEBUG === '1' || process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
    const promptToLog = isDebugMode || agent.prompt.length <= 500
      ? agent.prompt
      : `${agent.prompt.substring(0, 500)}...\n\n[Prompt truncated. Run with DEBUG=1 to see full prompt]`;

    stream.write(`=== Agent ${agentId} (${agent.name}) Log ===\n`);
    stream.write(`Started: ${agent.startTime}\n`);
    stream.write(`Prompt: ${promptToLog}\n`);
    stream.write(`${'='.repeat(60)}\n\n`);

    // Acquire lock asynchronously in background (after file is created)
    this.lockService.acquireLock(agent.logPath).catch(error => {
      logger.warn(`Failed to acquire lock for ${agent.logPath}:`, error);
    });

    logger.debug(`Created log stream for agent ${agentId} at ${agent.logPath}`);
    return stream;
  }

  /**
   * Write data to an agent's log file
   * If stream doesn't exist, creates it
   */
  write(agentId: number, data: string): void {
    let stream = this.activeStreams.get(agentId);

    if (!stream) {
      stream = this.createStream(agentId);
    }

    stream.write(data);
  }

  /**
   * Close an agent's log stream and release file lock
   */
  async closeStream(agentId: number): Promise<void> {
    const stream = this.activeStreams.get(agentId);
    if (stream) {
      const monitor = AgentMonitorService.getInstance();
      const agent = monitor.getAgent(agentId);

      // Release lock FIRST
      if (agent) {
        await this.lockService.releaseLock(agent.logPath);
      }

      // Then close stream
      stream.end();
      this.activeStreams.delete(agentId);
      logger.debug(`Closed log stream for agent ${agentId}`);
    }
  }

  /**
   * Read complete log file for an agent
   */
  readLog(agentId: number): string {
    const monitor = AgentMonitorService.getInstance();
    const agent = monitor.getAgent(agentId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (!existsSync(agent.logPath)) {
      return `No log file found at ${agent.logPath}`;
    }

    try {
      return readFileSync(agent.logPath, 'utf-8');
    } catch (error) {
      logger.error(`Failed to read log for agent ${agentId}: ${error}`);
      return `Error reading log file: ${error}`;
    }
  }

  /**
   * Stream logs in real-time (tail -f style)
   * For active agents, streams new content as it's written
   * For offline agents, returns complete log
   */
  async streamLogs(agentId: number, callback: (chunk: string) => void): Promise<void> {
    const monitor = AgentMonitorService.getInstance();
    const agent = monitor.getAgent(agentId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (!existsSync(agent.logPath)) {
      callback(`No log file found for agent ${agentId}\n`);
      return;
    }

    // For offline agents, just dump the complete log
    if (agent.status !== 'running') {
      const content = this.readLog(agentId);
      callback(content);
      return;
    }

    // For active agents, implement tail -f style streaming
    await this.tailFile(agent.logPath, callback);
  }

  /**
   * Tail a file (similar to tail -f)
   * Reads existing content and watches for new writes
   */
  private async tailFile(filePath: string, callback: (chunk: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // First, read existing content
        const stream = createReadStream(filePath, { encoding: 'utf-8' });

        stream.on('data', (chunk) => {
          callback(chunk.toString());
        });

        stream.on('end', () => {
          // After reading existing content, watch for new writes
          // For now, we'll just resolve - a production implementation
          // would use fs.watch() or similar to continue watching
          resolve();
        });

        stream.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get log file stats
   */
  getLogStats(agentId: number): { size: number; exists: boolean } {
    const monitor = AgentMonitorService.getInstance();
    const agent = monitor.getAgent(agentId);

    if (!agent || !existsSync(agent.logPath)) {
      return { size: 0, exists: false };
    }

    const stats = statSync(agent.logPath);
    return {
      size: stats.size,
      exists: true
    };
  }

  /**
   * Get writable stream for dual-streaming
   * Returns a function that can be called with data to write to log
   */
  getLogWriter(agentId: number): (data: string) => void {
    return (data: string) => {
      this.write(agentId, data);
    };
  }

  /**
   * Release all file locks
   * Used during cleanup/shutdown
   */
  async releaseAllLocks(): Promise<void> {
    await this.lockService.releaseAllLocks();
  }

  /**
   * Get log file path for an agent
   * Used by LogViewer to access log files
   */
  getLogPath(agentId: number): string | null {
    const monitor = AgentMonitorService.getInstance();
    const agent = monitor.getAgent(agentId);
    return agent?.logPath || null;
  }
}
