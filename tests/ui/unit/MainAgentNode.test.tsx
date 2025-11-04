import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { MainAgentNode } from '../../../src/ui/components/MainAgentNode';
import type { AgentState } from '../../../src/ui/state/types';

describe('MainAgentNode', () => {
  const createAgent = (overrides?: Partial<AgentState>): AgentState => ({
    id: 'agent-1',
    name: 'test-agent',
    engine: 'claude',
    status: 'pending',
    telemetry: { tokensIn: 0, tokensOut: 0 },
    startTime: Date.now(),
    toolCount: 0,
    thinkingCount: 0,
    ...overrides,
  });

  it('should display pending agent with status icon', () => {
    const agent = createAgent({ status: 'pending' });
    const { lastFrame } = render(
      <MainAgentNode
        agent={agent}
        index={0}
        isSelected={false}
        onSelect={() => {}}
      />
    );

    expect(lastFrame()).toContain('○');
    expect(lastFrame()).toContain('test-agent');
    expect(lastFrame()).toContain('claude');
  });

  it('should display running agent with spinner and telemetry', () => {
    const agent = createAgent({
      status: 'running',
      telemetry: { tokensIn: 1000, tokensOut: 500 },
      toolCount: 3,
    });
    const { lastFrame } = render(
      <MainAgentNode
        agent={agent}
        index={0}
        isSelected={false}
        onSelect={() => {}}
      />
    );

    expect(lastFrame()).toContain('⠋');
    expect(lastFrame()).toContain('1,000in/500out');
    expect(lastFrame()).toContain('3 tools');
  });

  it('should display completed agent with checkmark and duration', () => {
    const startTime = Date.now() - 65000; // 1 min 5 sec ago
    const agent = createAgent({
      status: 'completed',
      startTime,
      endTime: Date.now(),
      telemetry: { tokensIn: 5000, tokensOut: 2000 },
    });
    const { lastFrame } = render(
      <MainAgentNode
        agent={agent}
        index={0}
        isSelected={false}
        onSelect={() => {}}
      />
    );

    expect(lastFrame()).toContain('●');
    expect(lastFrame()).toContain('01:05');
  });

  it('should display retrying agent with error icon', () => {
    const agent = createAgent({
      status: 'retrying',
      error: 'API timeout',
    });
    const { lastFrame } = render(
      <MainAgentNode
        agent={agent}
        index={0}
        isSelected={false}
        onSelect={() => {}}
      />
    );

    expect(lastFrame()).toContain('⟳');
    expect(lastFrame()).toContain('API timeout');
  });

  it('should highlight when selected', () => {
    const agent = createAgent();
    const { lastFrame } = render(
      <MainAgentNode
        agent={agent}
        index={0}
        isSelected={true}
        onSelect={() => {}}
      />
    );

    expect(lastFrame()).toContain('>');
  });

  it('should show thinking count', () => {
    const agent = createAgent({
      status: 'running',
      thinkingCount: 2,
    });
    const { lastFrame } = render(
      <MainAgentNode
        agent={agent}
        index={0}
        isSelected={false}
        onSelect={() => {}}
      />
    );

    expect(lastFrame()).toContain('2 thinking');
  });
});
