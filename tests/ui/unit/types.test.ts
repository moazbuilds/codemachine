import { describe, it, expect } from 'bun:test';
import type {
  AgentStatus,
  AgentTelemetry,
  AgentState,
  SubAgentState,
  TriggeredAgentState,
  LoopState,
  WorkflowState,
} from '../../../src/ui/state/types';

describe('UI Type Definitions', () => {
  describe('AgentStatus', () => {
    it('should accept valid status values', () => {
      const validStatuses: AgentStatus[] = [
        'pending',
        'running',
        'completed',
        'skipped',
        'retrying',
      ];

      validStatuses.forEach((status) => {
        expect(status).toBeDefined();
      });
    });
  });

  describe('AgentTelemetry', () => {
    it('should create telemetry with required fields', () => {
      const telemetry: AgentTelemetry = {
        tokensIn: 1000,
        tokensOut: 500,
      };

      expect(telemetry.tokensIn).toBe(1000);
      expect(telemetry.tokensOut).toBe(500);
    });

    it('should support optional cached field', () => {
      const telemetry: AgentTelemetry = {
        tokensIn: 1000,
        tokensOut: 500,
        cached: 100,
      };

      expect(telemetry.cached).toBe(100);
    });

    it('should support optional cost and duration', () => {
      const telemetry: AgentTelemetry = {
        tokensIn: 1000,
        tokensOut: 500,
        cost: 0.05,
        duration: 120.5,
      };

      expect(telemetry.cost).toBe(0.05);
      expect(telemetry.duration).toBe(120.5);
    });
  });

  describe('AgentState', () => {
    it('should create valid agent state', () => {
      const agent: AgentState = {
        id: 'agent-123',
        name: 'test-agent',
        engine: 'claude',
        status: 'running',
        telemetry: { tokensIn: 100, tokensOut: 50 },
        startTime: Date.now(),
        toolCount: 5,
        thinkingCount: 2,
      };

      expect(agent.id).toBe('agent-123');
      expect(agent.engine).toBe('claude');
      expect(agent.toolCount).toBe(5);
    });
  });

  describe('SubAgentState', () => {
    it('should extend AgentState with parentId', () => {
      const subAgent: SubAgentState = {
        id: 'sub-123',
        name: 'sub-agent',
        engine: 'codex',
        status: 'completed',
        telemetry: { tokensIn: 50, tokensOut: 25 },
        startTime: Date.now(),
        toolCount: 2,
        thinkingCount: 1,
        parentId: 'parent-123',
      };

      expect(subAgent.parentId).toBe('parent-123');
    });
  });

  describe('TriggeredAgentState', () => {
    it('should extend AgentState with triggeredBy', () => {
      const triggered: TriggeredAgentState = {
        id: 'triggered-123',
        name: 'triggered-agent',
        engine: 'cursor',
        status: 'running',
        telemetry: { tokensIn: 200, tokensOut: 100 },
        startTime: Date.now(),
        toolCount: 3,
        thinkingCount: 1,
        triggeredBy: 'source-agent-123',
      };

      expect(triggered.triggeredBy).toBe('source-agent-123');
    });
  });

  describe('LoopState', () => {
    it('should create valid loop state', () => {
      const loopState: LoopState = {
        active: true,
        sourceAgent: 'validator',
        backSteps: 3,
        iteration: 2,
        maxIterations: 5,
        skipList: ['agent-1', 'agent-2'],
      };

      expect(loopState.active).toBe(true);
      expect(loopState.skipList).toHaveLength(2);
    });
  });

  describe('WorkflowState', () => {
    it('should create complete workflow state', () => {
      const state: WorkflowState = {
        workflowName: 'Test Workflow',
        version: '0.3.1',
        packageName: 'codemachine',
        startTime: Date.now(),
        totalSteps: 5,
        agents: [],
        subAgents: new Map(),
        triggeredAgents: [],
        loopState: null,
        expandedNodes: new Set(),
        showTelemetryView: false,
        selectedAgentId: null,
        selectedSubAgentId: null,
      };

      expect(state.workflowName).toBe('Test Workflow');
      expect(state.totalSteps).toBe(5);
    });
  });
});
