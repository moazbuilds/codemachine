import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowUIState } from '../../../src/ui/state/WorkflowUIState';
import type { AgentStatus } from '../../../src/ui/state/types';

describe('WorkflowUIState', () => {
  let state: WorkflowUIState;

  beforeEach(() => {
    state = new WorkflowUIState('Test Workflow', 5);
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      const currentState = state.getState();

      expect(currentState.workflowName).toBe('Test Workflow');
      expect(currentState.totalSteps).toBe(5);
      expect(currentState.currentStep).toBe(0);
      expect(currentState.uniqueCompleted).toBe(0);
      expect(currentState.totalExecuted).toBe(0);
      expect(currentState.agents).toEqual([]);
      expect(currentState.autoScroll).toBe(true);
      expect(currentState.showTelemetryView).toBe(false);
    });
  });

  describe('addMainAgent', () => {
    it('should add agent and increment total executed', () => {
      const agentId = state.addMainAgent('test-agent', 'claude', 0);

      const currentState = state.getState();
      expect(currentState.agents).toHaveLength(1);
      expect(currentState.totalExecuted).toBe(1);
      expect(currentState.agents[0].id).toBe(agentId);
      expect(currentState.agents[0].name).toBe('test-agent');
      expect(currentState.agents[0].engine).toBe('claude');
    });

    it('should generate unique IDs for agents', () => {
      const id1 = state.addMainAgent('agent-1', 'claude', 0);
      const id2 = state.addMainAgent('agent-2', 'codex', 1);

      expect(id1).not.toBe(id2);
    });
  });

  describe('updateAgentStatus', () => {
    it('should update status immutably', () => {
      const agentId = state.addMainAgent('test-agent', 'claude', 0);

      state.updateAgentStatus(agentId, 'running');

      const currentState = state.getState();
      expect(currentState.agents[0].status).toBe('running');
    });

    it('should set endTime on completed', () => {
      const agentId = state.addMainAgent('test-agent', 'claude', 0);

      state.updateAgentStatus(agentId, 'running');
      expect(state.getState().agents[0].endTime).toBeUndefined();

      state.updateAgentStatus(agentId, 'completed');
      expect(state.getState().agents[0].endTime).toBeGreaterThan(0);
    });

    it('should increment uniqueCompleted on completion', () => {
      const agentId = state.addMainAgent('test-agent', 'claude', 0);

      state.updateAgentStatus(agentId, 'completed');

      expect(state.getState().uniqueCompleted).toBe(1);
    });

    it('should not increment uniqueCompleted multiple times for same agent', () => {
      const agentId = state.addMainAgent('test-agent', 'claude', 0);

      state.updateAgentStatus(agentId, 'completed');
      state.updateAgentStatus(agentId, 'completed');

      expect(state.getState().uniqueCompleted).toBe(1);
    });
  });

  describe('appendOutput', () => {
    it('should add output line to buffer', () => {
      state.appendOutput('agent-1', 'Test output line');

      const currentState = state.getState();
      expect(currentState.outputBuffer).toContain('Test output line');
    });

    it('should limit buffer to 1000 lines', () => {
      for (let i = 0; i < 1500; i++) {
        state.appendOutput('agent-1', `Line ${i}`);
      }

      const currentState = state.getState();
      expect(currentState.outputBuffer.length).toBe(1000);
      expect(currentState.outputBuffer[0]).toBe('Line 500');
      expect(currentState.outputBuffer[999]).toBe('Line 1499');
    });

    it('should auto-scroll when autoScroll is true', () => {
      state.appendOutput('agent-1', 'Line 1');
      state.appendOutput('agent-1', 'Line 2');

      const currentState = state.getState();
      expect(currentState.scrollPosition).toBe(1);
    });
  });

  describe('updateAgentTelemetry', () => {
    it('should update telemetry data', () => {
      const agentId = state.addMainAgent('test-agent', 'claude', 0);

      state.updateAgentTelemetry(agentId, {
        tokensIn: 500,
        tokensOut: 200,
      });

      const currentState = state.getState();
      expect(currentState.agents[0].telemetry.tokensIn).toBe(500);
      expect(currentState.agents[0].telemetry.tokensOut).toBe(200);
    });
  });

  describe('state subscription', () => {
    it('should notify listeners on state change', () => {
      let notified = false;
      const unsubscribe = state.subscribe(() => {
        notified = true;
      });

      state.addMainAgent('test-agent', 'claude', 0);

      expect(notified).toBe(true);
      unsubscribe();
    });

    it('should unsubscribe correctly', () => {
      let count = 0;
      const unsubscribe = state.subscribe(() => {
        count++;
      });

      state.addMainAgent('agent-1', 'claude', 0);
      unsubscribe();
      state.addMainAgent('agent-2', 'codex', 1);

      expect(count).toBe(1);
    });
  });
});
