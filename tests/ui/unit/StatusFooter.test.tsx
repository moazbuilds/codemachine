import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { StatusFooter } from '../../../src/ui/components/StatusFooter';

describe('StatusFooter', () => {
  it('should display workflow view shortcuts', () => {
    const { lastFrame } = render(
      <StatusFooter currentView="workflow" />
    );

    expect(lastFrame()).toContain('[S]kip');
    expect(lastFrame()).toContain('[Q]uit');
    expect(lastFrame()).toContain('[T]elemetry');
  });

  it('should display telemetry view shortcuts', () => {
    const { lastFrame } = render(
      <StatusFooter currentView="telemetry" />
    );

    expect(lastFrame()).toContain('[T]');
    expect(lastFrame()).toContain('[Q]');
  });
});
