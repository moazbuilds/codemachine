import { describe, it, expect, beforeEach } from 'bun:test';
import { WorkflowUIState } from '../../../src/ui/state/WorkflowUIState';

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
      expect(currentState.agents).toEqual([]);
      expect(currentState.showTelemetryView).toBe(false);
    });
  });

  describe('addMainAgent', () => {
    it('should add agent with correct properties', () => {
      const agentId = state.addMainAgent('test-agent', 'claude', 0);

      const currentState = state.getState();
      expect(currentState.agents).toHaveLength(1);
      expect(currentState.agents[0].id).toBe(agentId);
      expect(currentState.agents[0].name).toBe('test-agent');
      expect(currentState.agents[0].engine).toBe('claude');
      expect(currentState.agents[0].stepIndex).toBe(0);
    });

    it('should generate unique IDs for agents', () => {
      const id1 = state.addMainAgent('agent-1', 'claude', 0);
      const id2 = state.addMainAgent('agent-2', 'codex', 1);

      expect(id1).not.toBe(id2);
    });

    it('should initialize agent with provided status', () => {
      state.addMainAgent('test-agent', 'claude', 0, 'completed');

      const currentState = state.getState();
      expect(currentState.agents[0].status).toBe('completed');
    });

    it('should handle multiple agents with different initial statuses', () => {
      state.addMainAgent('test-agent-1', 'claude', 0, 'completed');
      state.addMainAgent('test-agent-2', 'codex', 1, 'pending');

      const currentState = state.getState();
      expect(currentState.agents).toHaveLength(2);
      expect(currentState.agents[0].status).toBe('completed');
      expect(currentState.agents[1].status).toBe('pending');
    });

    it('should default to pending status when no initial status provided', () => {
      state.addMainAgent('test-agent', 'claude', 0);

      const currentState = state.getState();
      expect(currentState.agents[0].status).toBe('pending');
    });

    it('should support skipped initial status', () => {
      state.addMainAgent('test-agent', 'claude', 0, 'skipped');

      const currentState = state.getState();
      expect(currentState.agents[0].status).toBe('skipped');
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

    it('should update agent status to completed', () => {
      const agentId = state.addMainAgent('test-agent', 'claude', 0);

      state.updateAgentStatus(agentId, 'completed');

      expect(state.getState().agents[0].status).toBe('completed');
    });

    it('should handle multiple status updates for same agent', () => {
      const agentId = state.addMainAgent('test-agent', 'claude', 0);

      state.updateAgentStatus(agentId, 'completed');
      state.updateAgentStatus(agentId, 'running');
      state.updateAgentStatus(agentId, 'completed');

      expect(state.getState().agents[0].status).toBe('completed');
    });
  });

  // REMOVED: appendOutput() and in-memory buffering have been removed
  // UI now reads directly from log files using useLogStream hook
  // See: Unification of main and sub-agent logging architecture

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
    it('should notify listeners on state change', async () => {
      let notified = false;
      const unsubscribe = state.subscribe(() => {
        notified = true;
      });

      state.addMainAgent('test-agent', 'claude', 0);

      // Wait for throttled notification (16ms delay)
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(notified).toBe(true);
      unsubscribe();
    });

    it('should unsubscribe correctly', async () => {
      let count = 0;
      const unsubscribe = state.subscribe(() => {
        count++;
      });

      state.addMainAgent('agent-1', 'claude', 0);

      // Wait for throttled notification
      await new Promise(resolve => setTimeout(resolve, 20));

      unsubscribe();
      state.addMainAgent('agent-2', 'codex', 1);

      // Wait again to ensure second notification doesn't fire
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(count).toBe(1);
    });
  });
});