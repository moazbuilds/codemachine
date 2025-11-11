import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { WorkflowUIManager } from '../../../src/ui/manager/WorkflowUIManager';

/**
 * NOTE: Many tests in this file reference removed functionality:
 * - handleOutputChunk() method has been removed
 * - outputBuffer in-memory buffering has been removed
 * - UI now reads directly from log files using useLogStream hook
 *
 * Tests that use these features should be updated or removed.
 */

describe('Edge Cases and Error Handling', () => {
  let manager: WorkflowUIManager;
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    manager = new WorkflowUIManager('Edge Case Test', 5);
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (manager) {
      manager.stop();
    }
    consoleErrorSpy.mockRestore();
  });

  describe('Graceful Degradation', () => {
    it.skip('should fallback to console.log when no TTY', () => {
      const originalIsTTY = process.stdout.isTTY;
      const consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});

      // Mock non-TTY environment
      Object.defineProperty(process.stdout, 'isTTY', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const fallbackManager = new WorkflowUIManager('Fallback Test', 1);
      fallbackManager.start();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting workflow: Fallback Test')
      );

      // Test that operations still work in fallback mode
      const agentId = fallbackManager.addMainAgent('test-agent', 'claude', 0);
      fallbackManager.handleOutputChunk(agentId, 'Test output');
      fallbackManager.updateAgentStatus(agentId, 'completed');

      // Restore
      Object.defineProperty(process.stdout, 'isTTY', {
        value: originalIsTTY,
        writable: true,
        configurable: true,
      });

      fallbackManager.stop();
      consoleLogSpy.mockRestore();
    });

    it.skip('should handle Ink rendering failure gracefully', () => {
      // This would require mocking the Ink render function to throw
      // For now, we test that error handling exists
      const agentId = manager.addMainAgent('test-agent', 'claude', 0);

      // Send malformed output that might cause parsing errors
      manager.handleOutputChunk(agentId, null as unknown as string);
      manager.handleOutputChunk(agentId, undefined as unknown as string);
      manager.handleOutputChunk(agentId, {} as unknown as string);

      // Manager should still be functional
      const state = manager.getState();
      expect(state.agents).toHaveLength(1);
    });
  });

  describe('Memory Management', () => {
    it.skip('should limit output buffer to prevent memory leaks', async () => {
      const agentId = manager.addMainAgent('memory-test', 'claude', 0);

      // Send 2000 lines (buffer max is 1000)
      for (let i = 0; i < 2000; i++) {
        manager.handleOutputChunk(agentId, `Line ${i}: Some content...`);
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      const state = manager.getState();

      // Buffer should be capped at 1000 lines
      expect(state.outputBuffer.length).toBeLessThanOrEqual(1000);
    });

    it('should handle rapid agent creation without memory issues', () => {
      const startMemory = process.memoryUsage().heapUsed;

      // Create many agents rapidly
      for (let i = 0; i < 100; i++) {
        manager.addMainAgent(`agent-${i}`, 'claude', i);
      }

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (endMemory - startMemory) / 1024 / 1024; // MB

      // Memory increase should be reasonable (< 50MB for 100 agents)
      expect(memoryIncrease).toBeLessThan(50);
    });
  });

  describe('Invalid Input Handling', () => {
    it.skip('should handle invalid agent IDs gracefully', () => {
      manager.updateAgentStatus('non-existent-id', 'completed');
      manager.handleOutputChunk('non-existent-id', 'Some output');

      // Should not crash
      const state = manager.getState();
      expect(state.agents).toHaveLength(0);
    });

    it.skip('should handle malformed telemetry data', async () => {
      const agentId = manager.addMainAgent('telemetry-test', 'claude', 0);

      // Send various malformed telemetry
      manager.handleOutputChunk(agentId, 'Tokens: invalid/invalid');
      manager.handleOutputChunk(agentId, 'Tokens: in/out');
      manager.handleOutputChunk(agentId, 'Tokens: 999');
      manager.handleOutputChunk(agentId, 'Cost: invalid');

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not crash, telemetry should be 0 or unchanged
      const state = manager.getState();
      expect(state.agents[0]).toBeDefined();
    });

    it.skip('should handle extremely long output lines', async () => {
      const agentId = manager.addMainAgent('long-line-test', 'claude', 0);

      // Create a very long line (10KB)
      const longLine = 'x'.repeat(10000);
      manager.handleOutputChunk(agentId, longLine);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should handle without crashing
      const state = manager.getState();
      expect(state.outputBuffer.length).toBeGreaterThan(0);
    });

    it.skip('should handle special characters in output', async () => {
      const agentId = manager.addMainAgent('special-chars-test', 'claude', 0);

      const specialChars = [
        '💩 Emoji test',
        'Unicode: ñáéíóú',
        'Symbols: !@#$%^&*()',
        'Tabs:\t\t\ttest',
        'Newlines:\n\n\ntest',
        'Null bytes: \0\0\0',
      ];

      specialChars.forEach((line) => {
        manager.handleOutputChunk(agentId, line);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should handle all special characters
      const state = manager.getState();
      expect(state.outputBuffer.length).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent status updates', () => {
      const agent1 = manager.addMainAgent('concurrent-1', 'claude', 0);
      const agent2 = manager.addMainAgent('concurrent-2', 'codex', 1);
      const agent3 = manager.addMainAgent('concurrent-3', 'cursor', 2);

      // Update all statuses concurrently
      manager.updateAgentStatus(agent1, 'running');
      manager.updateAgentStatus(agent2, 'running');
      manager.updateAgentStatus(agent3, 'running');

      manager.updateAgentStatus(agent1, 'completed');
      manager.updateAgentStatus(agent2, 'retrying');
      manager.updateAgentStatus(agent3, 'completed');

      const state = manager.getState();

      expect(state.agents[0].status).toBe('completed');
      expect(state.agents[1].status).toBe('retrying');
      expect(state.agents[2].status).toBe('completed');
    });

    it.skip('should handle concurrent output chunks', async () => {
      const agent1 = manager.addMainAgent('output-1', 'claude', 0);
      const agent2 = manager.addMainAgent('output-2', 'codex', 1);

      // Send chunks rapidly from multiple agents
      for (let i = 0; i < 50; i++) {
        manager.handleOutputChunk(agent1, `Agent 1 line ${i}`);
        manager.handleOutputChunk(agent2, `Agent 2 line ${i}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const state = manager.getState();

      // Both agents should have output
      expect(state.outputBuffer.length).toBeGreaterThan(0);
    });
  });

  describe('State Consistency', () => {
    it('should maintain state consistency after errors', () => {
      const agentId = manager.addMainAgent('consistency-test', 'claude', 0);

      // Perform operations that might fail
      try {
        manager.handleOutputChunk(agentId, null as unknown as string);
      } catch (_e) {
        // Ignore
      }

      try {
        manager.updateAgentStatus('invalid-id', 'completed');
      } catch (_e) {
        // Ignore
      }

      // State should still be valid
      const state = manager.getState();
      expect(state.agents).toHaveLength(1);
      expect(state.agents[0].id).toBe(agentId);
    });

    it('should handle rapid start/stop cycles', () => {
      const testManager = new WorkflowUIManager('Start/Stop Test', 1);

      for (let i = 0; i < 10; i++) {
        testManager.start();
        testManager.stop();
      }

      // Should not crash or leak resources
      expect(true).toBe(true);
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle zero steps workflow', () => {
      const emptyManager = new WorkflowUIManager('Empty Workflow', 0);

      const state = emptyManager.getState();
      expect(state.totalSteps).toBe(0);

      emptyManager.stop();
    });

    it('should handle very large workflows', () => {
      const largeManager = new WorkflowUIManager('Large Workflow', 1000);

      const state = largeManager.getState();
      expect(state.totalSteps).toBe(1000);

      largeManager.stop();
    });

    it('should handle workflow with negative steps (edge case)', () => {
      const negativeManager = new WorkflowUIManager('Negative Steps', -1);

      const state = negativeManager.getState();
      expect(state.totalSteps).toBe(-1);

      negativeManager.stop();
    });
  });

  describe('Resource Cleanup', () => {
    it.skip('should clean up resources on stop', () => {
      const agentId = manager.addMainAgent('cleanup-test', 'claude', 0);

      // Generate some activity
      for (let i = 0; i < 100; i++) {
        manager.handleOutputChunk(agentId, `Line ${i}`);
      }

      manager.stop();

      // After stop, manager should not accept new operations
      // (This is a design decision - verify it doesn't crash)
      try {
        manager.addMainAgent('after-stop', 'claude', 1);
      } catch (_e) {
        // Expected to fail or be ignored
      }
    });
  });
});
