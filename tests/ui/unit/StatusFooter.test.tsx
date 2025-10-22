import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { StatusFooter } from '../../../src/ui/components/StatusFooter';

describe('StatusFooter', () => {
  it('should display workflow shortcuts', () => {
    const { lastFrame } = render(<StatusFooter />);

    expect(lastFrame()).toContain('[↑↓] Navigate');
    expect(lastFrame()).toContain('[ENTER] Expand/Collapse');
    expect(lastFrame()).toContain('[Ctrl+L] Full Logs');
    expect(lastFrame()).toContain('[T] Telemetry');
    expect(lastFrame()).toContain('[S] Skip');
    expect(lastFrame()).toContain('[Ctrl+C] Exit');
  });
});
