import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { SubAgentSummary } from '../../../src/ui/components/SubAgentSummary';
import type { SubAgentState } from '../../../src/ui/state/types';

describe('SubAgentSummary', () => {
  const createSubAgent = (overrides?: Partial<SubAgentState>): SubAgentState => ({
    id: 'sub-1',
    name: 'sub-agent',
    engine: 'codex',
    status: 'pending',
    telemetry: { tokensIn: 0, tokensOut: 0 },
    startTime: Date.now(),
    parentId: 'agent-1',
    ...overrides,
  });

  it('should not render when subAgents array is empty', () => {
    const { lastFrame } = render(
      <SubAgentSummary
        subAgents={[]}
        isExpanded={false}
        onToggle={() => {}}
      />
    );

    expect(lastFrame()).toBe('');
  });

  it('should display collapsed summary with counts', () => {
    const subAgents = [
      createSubAgent({ status: 'completed' }),
      createSubAgent({ id: 'sub-2', status: 'running' }),
      createSubAgent({ id: 'sub-3', status: 'pending' }),
    ];

    const { lastFrame } = render(
      <SubAgentSummary
        subAgents={subAgents}
        isExpanded={false}
        onToggle={() => {}}
      />
    );

    expect(lastFrame()).toContain('Sub-agents');
    expect(lastFrame()).toContain('1 completed');
    expect(lastFrame()).toContain('1 running');
    expect(lastFrame()).toContain('1 pending');
  });

  it('should show total tokens across all sub-agents', () => {
    const subAgents = [
      createSubAgent({ telemetry: { tokensIn: 1000, tokensOut: 500 } }),
      createSubAgent({ id: 'sub-2', telemetry: { tokensIn: 2000, tokensOut: 1000 } }),
    ];

    const { lastFrame } = render(
      <SubAgentSummary
        subAgents={subAgents}
        isExpanded={false}
        onToggle={() => {}}
      />
    );

    expect(lastFrame()).toContain('3,000in/1,500out');
  });

  it('should indicate expanded state', () => {
    const subAgents = [createSubAgent()];

    const { lastFrame } = render(
      <SubAgentSummary
        subAgents={subAgents}
        isExpanded={true}
        onToggle={() => {}}
      />
    );

    expect(lastFrame()).toContain('▼');
  });

  it('should indicate collapsed state', () => {
    const subAgents = [createSubAgent()];

    const { lastFrame } = render(
      <SubAgentSummary
        subAgents={subAgents}
        isExpanded={false}
        onToggle={() => {}}
      />
    );

    expect(lastFrame()).toContain('▶');
  });

  it('should not show zero counts', () => {
    const subAgents = [
      createSubAgent({ status: 'completed' }),
      createSubAgent({ id: 'sub-2', status: 'completed' }),
    ];

    const { lastFrame } = render(
      <SubAgentSummary
        subAgents={subAgents}
        isExpanded={false}
        onToggle={() => {}}
      />
    );

    expect(lastFrame()).toContain('2 completed');
    expect(lastFrame()).not.toContain('0 running');
    expect(lastFrame()).not.toContain('0 pending');
  });
});
