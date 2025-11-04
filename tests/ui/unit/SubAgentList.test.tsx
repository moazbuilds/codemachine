import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { SubAgentList } from '../../../src/ui/components/SubAgentList';
import type { SubAgentState } from '../../../src/ui/state/types';

describe('SubAgentList', () => {
  const createSubAgent = (overrides?: Partial<SubAgentState>): SubAgentState => ({
    id: 'sub-1',
    name: 'sub-agent',
    engine: 'codex',
    status: 'pending',
    telemetry: { tokensIn: 0, tokensOut: 0 },
    startTime: Date.now(),
    toolCount: 0,
    thinkingCount: 0,
    parentId: 'agent-1',
    ...overrides,
  });

  it('should not render when subAgents array is empty', () => {
    const { lastFrame } = render(
      <SubAgentList
        subAgents={[]}
        selectedSubAgentId={null}
        onSelect={() => {}}
      />
    );

    expect(lastFrame()).toBe('');
  });

  it('should display list of sub-agents with status icons', () => {
    const subAgents = [
      createSubAgent({ name: 'validator', status: 'completed' }),
      createSubAgent({ id: 'sub-2', name: 'formatter', status: 'running' }),
    ];

    const { lastFrame } = render(
      <SubAgentList
        subAgents={subAgents}
        selectedSubAgentId={null}
        onSelect={() => {}}
      />
    );

    expect(lastFrame()).toContain('validator');
    expect(lastFrame()).toContain('formatter');
    expect(lastFrame()).toContain('●'); // completed icon
    expect(lastFrame()).toContain('⠋'); // running icon
  });

  it('should highlight selected sub-agent', () => {
    const subAgents = [
      createSubAgent({ id: 'sub-1', name: 'validator' }),
      createSubAgent({ id: 'sub-2', name: 'formatter' }),
    ];

    const { lastFrame } = render(
      <SubAgentList
        subAgents={subAgents}
        selectedSubAgentId="sub-2"
        onSelect={() => {}}
      />
    );

    const lines = lastFrame()!.split('\n');
    const formatterLine = lines.find(line => line.includes('formatter'));
    expect(formatterLine).toContain('>');
  });

  it('should display telemetry for each sub-agent', () => {
    const subAgents = [
      createSubAgent({
        name: 'validator',
        telemetry: { tokensIn: 1000, tokensOut: 500 },
      }),
    ];

    const { lastFrame } = render(
      <SubAgentList
        subAgents={subAgents}
        selectedSubAgentId={null}
        onSelect={() => {}}
      />
    );

    expect(lastFrame()).toContain('1,000in/500out');
  });

  it('should display duration for completed agents', () => {
    const startTime = Date.now() - 30000; // 30 seconds ago
    const subAgents = [
      createSubAgent({
        name: 'validator',
        status: 'completed',
        startTime,
        endTime: Date.now(),
      }),
    ];

    const { lastFrame } = render(
      <SubAgentList
        subAgents={subAgents}
        selectedSubAgentId={null}
        onSelect={() => {}}
      />
    );

    expect(lastFrame()).toContain('00:30');
  });

  it('should show error message for retrying agents', () => {
    const subAgents = [
      createSubAgent({
        name: 'validator',
        status: 'retrying',
        error: 'Connection timeout',
      }),
    ];

    const { lastFrame } = render(
      <SubAgentList
        subAgents={subAgents}
        selectedSubAgentId={null}
        onSelect={() => {}}
      />
    );

    expect(lastFrame()).toContain('Connection timeout');
  });

  it('should limit list to first 10 agents when more than 10', () => {
    const subAgents = Array.from({ length: 15 }, (_, i) =>
      createSubAgent({ id: `sub-${i}`, name: `agent-${i}` })
    );

    const { lastFrame } = render(
      <SubAgentList
        subAgents={subAgents}
        selectedSubAgentId={null}
        onSelect={() => {}}
      />
    );

    expect(lastFrame()).toContain('agent-0');
    expect(lastFrame()).toContain('agent-9');
    expect(lastFrame()).toContain('↓ 5 more below');
    expect(lastFrame()).not.toContain('agent-10');
  });
});
