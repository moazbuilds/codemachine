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

    const agent: AgentRecord = {
      id,
      name: input.name,
      status: 'running',
      parentId: input.parentId,
      startTime,
      prompt: input.prompt,
      logPath: logPath || this.getDefaultLogPath(id, input.name, startTime),
      children: []
    };

    // If this agent has a parent, add this agent to parent's children list
    if (input.parentId) {
      const parent = this.registry.get(input.parentId);
      if (parent) {
        parent.children.push(id);
        this.registry.save(parent);
      }
    }

    this.registry.save(agent);
    logger.info(`Registered agent ${id} (${input.name})`);
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

    this.registry.update(id, {
      status: 'completed',
      endTime,
      duration,
      telemetry
    });

    logger.info(`Agent ${id} (${agent.name}) completed in ${duration}ms`);
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

    this.registry.update(id, {
      status: 'failed',
      endTime,
      duration,
      error: errorMessage
    });

    logger.error(`Agent ${id} (${agent.name}) failed after ${duration}ms: ${errorMessage}`);
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
   */
  getAgent(id: number): AgentRecord | undefined {
    return this.registry.get(id);
  }

  /**
   * Get all agents
   */
  getAllAgents(): AgentRecord[] {
    return this.registry.getAll();
  }

  /**
   * Get all active (running) agents
   */
  getActiveAgents(): AgentRecord[] {
    return this.registry.getActive();
  }

  /**
   * Get all offline (completed/failed) agents
   */
  getOfflineAgents(): AgentRecord[] {
    return this.registry.getOffline();
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
   */
  getRootAgents(): AgentRecord[] {
    return this.getAllAgents().filter(agent => !agent.parentId);
  }

  /**
   * Get children of a specific agent
   */
  getChildren(parentId: number): AgentRecord[] {
    return this.registry.getChildren(parentId);
  }

  /**
   * Build hierarchical tree structure for display
   */
  buildAgentTree(): AgentTreeNode[] {
    const roots = this.getRootAgents();
    return roots.map(root => this.buildTreeNode(root));
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
