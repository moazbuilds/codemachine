import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { TriggeredAgentList } from '../../../src/ui/components/TriggeredAgentList';
import type { TriggeredAgentState } from '../../../src/ui/state/types';

describe('TriggeredAgentList', () => {
  const createTriggeredAgent = (
    overrides?: Partial<TriggeredAgentState>
  ): TriggeredAgentState => ({
    id: 'triggered-1',
    name: 'triggered-agent',
    engine: 'cursor',
    status: 'pending',
    telemetry: { tokensIn: 0, tokensOut: 0 },
    startTime: Date.now(),
    triggeredBy: 'main-agent-1',
    triggerCondition: 'on_failure',
    ...overrides,
  });

  it('should not render when triggeredAgents array is empty', () => {
    const { lastFrame } = render(
      <TriggeredAgentList triggeredAgents={[]} />
    );

    expect(lastFrame()).toBe('');
  });

  it('should display section header for triggered agents', () => {
    const agents = [createTriggeredAgent()];

    const { lastFrame } = render(
      <TriggeredAgentList triggeredAgents={agents} />
    );

    expect(lastFrame()).toContain('Triggered Agents');
  });

  it('should display agent with trigger attribution', () => {
    const agents = [
      createTriggeredAgent({
        name: 'error-handler',
        triggeredBy: 'main-validator',
        triggerCondition: 'on_failure',
      }),
    ];

    const { lastFrame } = render(
      <TriggeredAgentList triggeredAgents={agents} />
    );

    expect(lastFrame()).toContain('error-handler');
    expect(lastFrame()).toContain('main-validator');
    expect(lastFrame()).toContain('on_failure');
  });

  it('should display status icons and colors', () => {
    const agents = [
      createTriggeredAgent({ status: 'completed' }),
      createTriggeredAgent({ id: 'triggered-2', status: 'running' }),
    ];

    const { lastFrame } = render(
      <TriggeredAgentList triggeredAgents={agents} />
    );

    expect(lastFrame()).toContain('●'); // completed
    expect(lastFrame()).toContain('⠋'); // running
  });

  it('should display telemetry information', () => {
    const agents = [
      createTriggeredAgent({
        telemetry: { tokensIn: 2000, tokensOut: 1000 },
      }),
    ];

    const { lastFrame } = render(
      <TriggeredAgentList triggeredAgents={agents} />
    );

    expect(lastFrame()).toContain('2,000in/1,000out');
  });

  it('should display duration for completed agents', () => {
    const startTime = Date.now() - 45000; // 45 seconds ago
    const agents = [
      createTriggeredAgent({
        status: 'completed',
        startTime,
        endTime: Date.now(),
      }),
    ];

    const { lastFrame } = render(
      <TriggeredAgentList triggeredAgents={agents} />
    );

    expect(lastFrame()).toContain('00:45');
  });

  it('should show error message for retrying agents', () => {
    const agents = [
      createTriggeredAgent({
        status: 'retrying',
        error: 'Trigger condition not met',
      }),
    ];

    const { lastFrame } = render(
      <TriggeredAgentList triggeredAgents={agents} />
    );

    expect(lastFrame()).toContain('Trigger condition not met');
  });

  it('should limit display to first 5 agents when more than 5', () => {
    const agents = Array.from({ length: 8 }, (_, i) =>
      createTriggeredAgent({
        id: `triggered-${i}`,
        name: `handler-${i}`,
        triggeredBy: 'main',
      })
    );

    const { lastFrame } = render(
      <TriggeredAgentList triggeredAgents={agents} />
    );

    expect(lastFrame()).toContain('handler-0');
    expect(lastFrame()).toContain('handler-4');
    expect(lastFrame()).toContain('+3 more');
    expect(lastFrame()).not.toContain('handler-5');
  });
});
