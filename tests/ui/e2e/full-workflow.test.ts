import { describe, it, expect } from 'bun:test';
import { WorkflowUIManager } from '../../../src/ui/manager/WorkflowUIManager';
import { parseTelemetryChunk } from '../../../src/ui/utils/telemetryParser';
import { processOutputChunk } from '../../../src/ui/utils/outputProcessor';
import fs from 'fs';
import path from 'path';

/**
 * NOTE: Many tests in this file reference removed functionality:
 * - handleOutputChunk() method has been removed
 * - outputBuffer in-memory buffering has been removed
 * - UI now reads directly from log files using useLogStream hook
 *
 * Tests that use these features should be updated or removed.
 */

describe('E2E: Full Workflow Execution', () => {
  const fixturesDir = path.join(__dirname, '../fixtures');

  const loadFixture = (filename: string): string => {
    return fs.readFileSync(path.join(fixturesDir, filename), 'utf-8');
  };

  it.skip('should execute complete workflow with Claude agent', async () => {
    const manager = new WorkflowUIManager('E2E Test Workflow', 1);

    // Add agent
    const agentId = manager.addMainAgent('code-analyzer', 'claude', 0);
    manager.updateAgentStatus(agentId, 'running');

    // Load and process Claude fixture output
    const claudeOutput = loadFixture('claude-output.txt');
    const lines = claudeOutput.split('\n').filter((line) => line.trim());

    // Simulate streaming output
    for (const line of lines) {
      manager.handleOutputChunk(agentId, line);
    }

    // Wait for batch processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    manager.updateAgentStatus(agentId, 'completed');

    const state = manager.getState();

    // Verify agent state
    expect(state.agents).toHaveLength(1);
    expect(state.agents[0].status).toBe('completed');
    expect(state.agents[0].name).toBe('code-analyzer');
    expect(state.agents[0].engine).toBe('claude');

    // Verify telemetry was captured
    expect(state.agents[0].telemetry.tokensIn).toBeGreaterThan(0);
    expect(state.agents[0].telemetry.tokensOut).toBeGreaterThan(0);

    // Verify tool counts
    expect(state.agents[0].toolCount).toBeGreaterThan(0);

    // Verify output buffer
    expect(state.outputBuffer.length).toBeGreaterThan(0);

    manager.stop();
  });

  it.skip('should handle multiple agents with different engines', async () => {
    const manager = new WorkflowUIManager('Multi-Engine Workflow', 3);

    // Agent 1: Claude
    const agent1 = manager.addMainAgent('analyzer', 'claude', 0);
    manager.updateAgentStatus(agent1, 'running');
    const claudeOutput = loadFixture('claude-output.txt');
    claudeOutput.split('\n').forEach((line) => {
      if (line.trim()) manager.handleOutputChunk(agent1, line);
    });
    manager.updateAgentStatus(agent1, 'completed');

    // Agent 2: Codex
    const agent2 = manager.addMainAgent('coder', 'codex', 1);
    manager.updateAgentStatus(agent2, 'running');
    const codexOutput = loadFixture('codex-output.txt');
    codexOutput.split('\n').forEach((line) => {
      if (line.trim()) manager.handleOutputChunk(agent2, line);
    });
    manager.updateAgentStatus(agent2, 'completed');

    // Agent 3: Cursor
    const agent3 = manager.addMainAgent('tester', 'cursor', 2);
    manager.updateAgentStatus(agent3, 'running');
    const cursorOutput = loadFixture('cursor-output.txt');
    cursorOutput.split('\n').forEach((line) => {
      if (line.trim()) manager.handleOutputChunk(agent3, line);
    });
    manager.updateAgentStatus(agent3, 'completed');

    // Wait for all batch processing
    await new Promise((resolve) => setTimeout(resolve, 150));

    const state = manager.getState();

    // Verify all agents
    expect(state.agents).toHaveLength(3);

    // Verify each agent captured telemetry
    state.agents.forEach((agent) => {
      expect(agent.status).toBe('completed');
      expect(agent.telemetry.tokensIn + agent.telemetry.tokensOut).toBeGreaterThan(0);
    });

    manager.stop();
  });

  it('should handle telemetry parsing from all engines', () => {
    // Claude format
    const claudeTelemetry = parseTelemetryChunk(
      '⏱️  Duration: 2345ms | Cost: $0.0234 | Tokens: 2,456in/1,234out'
    );
    expect(claudeTelemetry).toEqual({
      tokensIn: 2456,
      tokensOut: 1234,
      cost: 0.0234,
      duration: 2.345,
    });

    // Codex format
    const codexTelemetry = parseTelemetryChunk('⏱️  Tokens: 1,000in/300out (100 cached)');
    expect(codexTelemetry).toEqual({
      tokensIn: 1000,
      tokensOut: 300,
      cached: 100,
    });

    // Cursor format
    const cursorTelemetry = parseTelemetryChunk(
      '⏱️  Duration: 3456ms | Cost: $0.0080 | Tokens: 800in/400out'
    );
    expect(cursorTelemetry).toEqual({
      tokensIn: 800,
      tokensOut: 400,
      cost: 0.008,
      duration: 3.456,
    });
  });

  it.skip('should handle output classification correctly', () => {
    const cases = [
      { input: '🔧 TOOL: Read file.ts', expected: 'tool' },
      { input: '🧠 THINKING: Need to analyze...', expected: 'thinking' },
      { input: '💬 TEXT: Starting process...', expected: 'text' },
      { input: '⏱️  Tokens: 500in/200out', expected: 'telemetry' },
      { input: 'ERROR: File not found', expected: 'error' },
    ];

    cases.forEach(({ input, expected }) => {
      const result = processOutputChunk(input);
      expect(result.type).toBe(expected);
    });
  });

  it.skip('should track cumulative telemetry across workflow', async () => {
    const manager = new WorkflowUIManager('Telemetry Test', 2);

    const agent1 = manager.addMainAgent('agent-1', 'claude', 0);
    manager.handleOutputChunk(agent1, 'Tokens: 1000in/500out');

    const agent2 = manager.addMainAgent('agent-2', 'codex', 1);
    manager.handleOutputChunk(agent2, 'Tokens: 2000in/1000out');

    await new Promise((resolve) => setTimeout(resolve, 100));

    const state = manager.getState();

    const totalIn = state.agents.reduce((sum, a) => sum + a.telemetry.tokensIn, 0);
    const totalOut = state.agents.reduce((sum, a) => sum + a.telemetry.tokensOut, 0);

    expect(totalIn).toBeGreaterThan(2000);
    expect(totalOut).toBeGreaterThan(1000);

    manager.stop();
  });

  it.skip('should maintain performance under load', async () => {
    const manager = new WorkflowUIManager('Performance Test', 1);
    const agentId = manager.addMainAgent('load-agent', 'claude', 0);

    const startTime = Date.now();

    // Send 500 output chunks rapidly
    for (let i = 0; i < 500; i++) {
      manager.handleOutputChunk(agentId, `Output line ${i}: Some content here...`);
    }

    const processingTime = Date.now() - startTime;

    // Should handle 500 chunks in under 500ms (1ms per chunk budget)
    expect(processingTime).toBeLessThan(500);

    // Wait for batch processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    const state = manager.getState();

    // Output buffer should be limited to 1000 lines max
    expect(state.outputBuffer.length).toBeLessThanOrEqual(1000);

    manager.stop();
  });
});
