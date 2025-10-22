import type { ParsedTelemetry } from '../../ui/utils/telemetryParser.js';
import { AgentRegistry } from './registry.js';
import type { AgentRecord, AgentQueryFilters, AgentStatus, RegisterAgentInput } from './types.js';
import * as logger from '../../shared/logging/logger.js';

/**
 * Central singleton service for monitoring agent lifecycle
 * Tracks all agent executions (workflow, CLI, orchestrated)
 */
export class AgentMonitorService {
  private static instance: AgentMonitorService;
  private registry: AgentRegistry;

  private constructor() {
    this.registry = new AgentRegistry();
    logger.debug('AgentMonitorService initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentMonitorService {
    if (!AgentMonitorService.instance) {
      AgentMonitorService.instance = new AgentMonitorService();
    }
    return AgentMonitorService.instance;
  }

  /**
   * Register a new agent and return its ID
   */
  register(input: RegisterAgentInput, logPath?: string): number {
    const id = this.registry.getNextId();
    const startTime = new Date().toISOString();
    const pid = input.pid ?? process.pid;

    const agent: AgentRecord = {
      id,
      name: input.name,
      status: 'running',
      parentId: input.parentId,
      pid,
      startTime,
      prompt: input.prompt,
      logPath: logPath || this.getDefaultLogPath(id, input.name, startTime),
      children: [],
      engineProvider: input.engineProvider,
      modelName: input.modelName,
    };

    // If this agent has a parent, add this agent to parent's children list
    if (input.parentId) {
      // Reload registry to get latest parent state from disk (multi-process safety)
      // Critical: subprocess may have updated parent's children array
      this.registry.reload();

      const parent = this.registry.get(input.parentId);
      if (parent) {
        parent.children.push(id);
        this.registry.save(parent);
      }
    }

    this.registry.save(agent);
    logger.debug(`Registered agent ${id} (${input.name})`);
    return id;
  }

  /**
   * Mark agent as completed
   */
  complete(id: number, telemetry?: ParsedTelemetry): void {
    const agent = this.registry.get(id);
    if (!agent) {
      logger.warn(`Attempted to complete non-existent agent ${id}`);
      return;
    }

    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(agent.startTime).getTime();

    const updates: Partial<AgentRecord> = {
      status: 'completed',
      endTime,
      duration,
    };

    // Only update telemetry if provided (preserve existing telemetry otherwise)
    if (telemetry) {
      updates.telemetry = telemetry;
    }

    this.registry.update(id, updates);

    logger.debug(`Agent ${id} (${agent.name}) completed in ${duration}ms`);
  }

  /**
   * Mark agent as failed
   */
  fail(id: number, error: Error | string): void {
    const agent = this.registry.get(id);
    if (!agent) {
      logger.warn(`Attempted to fail non-existent agent ${id}`);
      return;
    }

    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(agent.startTime).getTime();
    const errorMessage = error instanceof Error ? error.message : error;

    // Preserve existing telemetry when failing
    this.registry.update(id, {
      status: 'failed',
      endTime,
      duration,
      error: errorMessage
      // Note: telemetry is NOT included here, so existing telemetry is preserved
    });

    // Suppress error logs for user interruptions (Ctrl+C) - use debug instead
    if (errorMessage.includes('User interrupted')) {
      logger.debug(`Agent ${id} (${agent.name}) aborted by user after ${duration}ms`);
    } else if (errorMessage.includes('operation was aborted')) {
      logger.debug(`Agent ${id} (${agent.name}) failed after ${duration}ms: ${errorMessage}`);
    } else {
      logger.error(`Agent ${id} (${agent.name}) failed after ${duration}ms: ${errorMessage}`);
    }
  }

  /**
   * Update agent status
   */
  updateStatus(id: number, status: AgentStatus): void {
    this.registry.update(id, { status });
  }

  /**
   * Update agent telemetry
   */
  updateTelemetry(id: number, telemetry: ParsedTelemetry): void {
    this.registry.update(id, { telemetry });
  }

  /**
   * Get agent by ID
   * Reloads from disk to ensure fresh data
   */
  getAgent(id: number): AgentRecord | undefined {
    // Reload to get latest state (may have been updated by subprocess)
    this.registry.reload();
    const agent = this.registry.get(id);
    return agent ? this.validateAndCleanupAgent(agent) : undefined;
  }

  /**
   * Get all agents
   * Reloads from disk to ensure fresh data across processes
   */
  getAllAgents(): AgentRecord[] {
    // Reload to get latest state from disk (multi-process safety)
    this.registry.reload();
    return this.registry.getAll().map(agent => this.validateAndCleanupAgent(agent));
  }

  /**
   * Get all active (running) agents
   */
  getActiveAgents(): AgentRecord[] {
    return this.getAllAgents().filter(agent => agent.status === 'running');
  }

  /**
   * Get all offline (completed/failed) agents
   */
  getOfflineAgents(): AgentRecord[] {
    return this.getAllAgents().filter(agent => agent.status !== 'running');
  }

  /**
   * Get agents matching query filters
   */
  queryAgents(filters: AgentQueryFilters): AgentRecord[] {
    let agents = this.getAllAgents();

    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      agents = agents.filter(agent => statuses.includes(agent.status));
    }

    if (filters.parentId !== undefined) {
      agents = agents.filter(agent => agent.parentId === filters.parentId);
    }

    if (filters.name) {
      agents = agents.filter(agent => agent.name === filters.name);
    }

    return agents;
  }

  /**
   * Get root agents (agents without parents)
   * Reloads from disk to ensure fresh data
   */
  getRootAgents(): AgentRecord[] {
    // Reload already happens in getAllAgents()
    return this.getAllAgents().filter(agent => !agent.parentId);
  }

  /**
   * Get children of a specific agent
   * Reloads from disk to ensure fresh data
   */
  getChildren(parentId: number): AgentRecord[] {
    // Reload to get latest children array (may be updated by subprocess)
    this.registry.reload();
    return this.registry.getChildren(parentId).map(agent => this.validateAndCleanupAgent(agent));
  }

  /**
   * Build hierarchical tree structure for display
   * Reloads from disk to ensure fresh hierarchy
   */
  buildAgentTree(): AgentTreeNode[] {
    // Reload to ensure we have latest data including children arrays
    this.registry.reload();
    const roots = this.getRootAgents();
    return roots.map(root => this.buildTreeNode(root));
  }

  /**
   * Get full subtree for an agent (agent + all descendants recursively)
   */
  getFullSubtree(agentId: number): AgentRecord[] {
    const agent = this.getAgent(agentId);
    if (!agent) {
      return [];
    }

    const result: AgentRecord[] = [agent];
    const children = this.getChildren(agentId);

    for (const child of children) {
      result.push(...this.getFullSubtree(child.id));
    }

    return result;
  }

  /**
   * Clear all descendants of an agent (used for loop resets)
   * Removes all child agents recursively from the registry
   */
  clearDescendants(agentId: number): void {
    this.registry.reload();
    const agent = this.registry.get(agentId);
    if (!agent) {
      return;
    }

    // Get all descendants before clearing
    const children = this.getChildren(agentId);

    // Recursively delete all descendants
    for (const child of children) {
      this.clearDescendants(child.id);
      this.registry.delete(child.id);
    }

    // Clear the children array of the parent
    agent.children = [];
    this.registry.save(agent);

    logger.debug(`Cleared ${children.length} descendants for agent ${agentId}`);
  }

  /**
   * Group all agents by their root parent (top-level parent)
   * Returns a map of root agent ID -> array of all descendants
   */
  getAgentsByRoot(): Map<number, AgentRecord[]> {
    const grouped = new Map<number, AgentRecord[]>();
    const roots = this.getRootAgents();

    for (const root of roots) {
      const subtree = this.getFullSubtree(root.id);
      grouped.set(root.id, subtree);
    }

    return grouped;
  }

  /**
   * Validate agent status using PID and auto-mark as failed if process exited
   */
  private validateAndCleanupAgent(agent: AgentRecord): AgentRecord {
    if (agent.status !== 'running' || !agent.pid) {
      return agent;
    }

    if (AgentMonitorService.isProcessAlive(agent.pid)) {
      return agent;
    }

    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(agent.startTime).getTime();
    const failureUpdate: Partial<AgentRecord> = {
      status: 'failed',
      endTime,
      duration,
      error: 'Process terminated unexpectedly'
    };

    this.registry.update(agent.id, failureUpdate);
    logger.debug(
      `Agent ${agent.id} (${agent.name}) marked as failed: process ${agent.pid} is no longer running`
    );

    const updated = this.registry.get(agent.id);
    return updated ?? { ...agent, ...failureUpdate };
  }

  /**
   * Lightweight PID check (signal 0) to determine if process is alive
   */
  private static isProcessAlive(pid: number): boolean {
    if (!pid || pid <= 0) {
      return false;
    }

    try {
      process.kill(pid, 0);
      return true;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'EPERM') {
          return true;
        }
      }
      return false;
    }
  }

  private buildTreeNode(agent: AgentRecord): AgentTreeNode {
    const children = this.getChildren(agent.id);
    return {
      agent,
      children: children.map(child => this.buildTreeNode(child))
    };
  }

  /**
   * Generate default log path for an agent
   */
  private getDefaultLogPath(id: number, name: string, startTime: string): string {
    const timestamp = new Date(startTime).toISOString().replace(/:/g, '-').replace(/\..+/, '');
    return `.codemachine/logs/agent-${id}-${name}-${timestamp}.log`;
  }
}

/**
 * Tree node for hierarchical agent display
 */
export interface AgentTreeNode {
  agent: AgentRecord;
  children: AgentTreeNode[];
}
