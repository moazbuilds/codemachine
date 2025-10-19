import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { LoopIndicator } from '../../../src/ui/components/LoopIndicator';
import type { LoopState } from '../../../src/ui/state/types';

describe('LoopIndicator', () => {
  it('should not render when loopState is null', () => {
    const { lastFrame } = render(<LoopIndicator loopState={null} />);

    expect(lastFrame()).toBe('');
  });

  it('should not render when loop is not active', () => {
    const loopState: LoopState = {
      active: false,
      sourceAgent: 'validator',
      backSteps: 3,
      iteration: 1,
      maxIterations: 5,
      skipList: [],
    };

    const { lastFrame } = render(<LoopIndicator loopState={loopState} />);

    expect(lastFrame()).toBe('');
  });

  it('should render loop information when active', () => {
    const loopState: LoopState = {
      active: true,
      sourceAgent: 'validator',
      backSteps: 3,
      iteration: 2,
      maxIterations: 5,
      skipList: ['agent-1'],
    };

    const { lastFrame } = render(<LoopIndicator loopState={loopState} />);

    expect(lastFrame()).toContain('Loop: validator');
    expect(lastFrame()).toContain('Back 3 steps');
    expect(lastFrame()).toContain('Iteration 2/5');
  });

  it('should display skip list', () => {
    const loopState: LoopState = {
      active: true,
      sourceAgent: 'validator',
      backSteps: 2,
      iteration: 1,
      maxIterations: 5,
      skipList: ['agent-1', 'agent-2'],
    };

    const { lastFrame } = render(<LoopIndicator loopState={loopState} />);

    expect(lastFrame()).toContain('Skipping: agent-1, agent-2');
  });
});
