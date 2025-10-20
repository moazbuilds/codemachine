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
        total={{
          tokensIn: 1000,
          tokensOut: 2000,
          cached: 0,
        }}
      />
    );

    expect(lastFrame()).not.toContain('cached');
  });
});
