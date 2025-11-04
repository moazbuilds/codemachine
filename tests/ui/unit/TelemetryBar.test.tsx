import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { TelemetryBar } from '../../../src/ui/components/TelemetryBar';

describe('TelemetryBar', () => {
  it('should render workflow name and runtime', () => {
    const { lastFrame } = render(
      <TelemetryBar
        workflowName="Test Workflow"
        runtime="00:12:45"
        status="running"
        total={{
          tokensIn: 1000,
          tokensOut: 2000,
        }}
      />
    );

    expect(lastFrame()).toContain('Test Workflow');
    expect(lastFrame()).toContain('00:12:45');
  });

  it('should display token totals', () => {
    const { lastFrame } = render(
      <TelemetryBar
        workflowName="Test Workflow"
        runtime="00:00:05"
        status="running"
        total={{
          tokensIn: 1500,
          tokensOut: 3500,
        }}
      />
    );

    expect(lastFrame()).toContain('Tokens:');
    expect(lastFrame()).toContain('1,500in');
    expect(lastFrame()).toContain('3,500out');
  });

  it('should show cached tokens if present', () => {
    const { lastFrame } = render(
      <TelemetryBar
        workflowName="Test Workflow"
        runtime="00:00:10"
        status="running"
        total={{
          tokensIn: 1000,
          tokensOut: 2000,
          cached: 500,
        }}
      />
    );

    expect(lastFrame()).toContain('cached');
    expect(lastFrame()).toContain('500');
  });

  it('should not show cached tokens when zero', () => {
    const { lastFrame } = render(
      <TelemetryBar
        workflowName="Test Workflow"
        runtime="00:00:10"
        status="running"
        total={{
          tokensIn: 1000,
          tokensOut: 2000,
          cached: 0,
        }}
      />
    );

    expect(lastFrame()).not.toContain('cached');
  });

  it('should prompt for second Ctrl+C while stopping', () => {
    const { lastFrame } = render(
      <TelemetryBar
        workflowName="Test Workflow"
        runtime="00:01:00"
        status="stopping"
        total={{
          tokensIn: 10,
          tokensOut: 10,
        }}
      />
    );

    expect(lastFrame()).toContain('Press Ctrl+C again to close the session');
  });

  it('should show completed and stopped statuses', () => {
    const completed = render(
      <TelemetryBar
        workflowName="Completed Workflow"
        runtime="00:05:00"
        status="completed"
        total={{ tokensIn: 0, tokensOut: 0 }}
      />
    );
    expect(completed.lastFrame()).toContain('● Completed');

    const stopped = render(
      <TelemetryBar
        workflowName="Stopped Workflow"
        runtime="00:05:00"
        status="stopped"
        total={{ tokensIn: 0, tokensOut: 0 }}
      />
    );
    expect(stopped.lastFrame()).toContain('⏹ Stopped by user');
  });
});
