import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { StatusFooter } from '../../../src/ui/components/StatusFooter';

describe('StatusFooter', () => {
  it('should display workflow view shortcuts', () => {
    const { lastFrame } = render(
      <StatusFooter currentView="workflow" />
    );

    expect(lastFrame()).toContain('[↑↓] Navigate');
    expect(lastFrame()).toContain('[ENTER] Expand/Collapse');
    expect(lastFrame()).toContain('[Ctrl+L] Full Logs');
    expect(lastFrame()).toContain('[T] Telemetry');
    expect(lastFrame()).toContain('[S] Skip');
    expect(lastFrame()).toContain('[Q] Quit');
  });

  it('should display telemetry view shortcuts', () => {
    const { lastFrame } = render(
      <StatusFooter currentView="telemetry" />
    );

    expect(lastFrame()).toContain('[T]');
    expect(lastFrame()).toContain('[Q]');
  });
});
