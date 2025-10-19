import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { ProgressLine } from '../../../src/ui/components/ProgressLine';

describe('ProgressLine', () => {
  it('should display current step and total steps', () => {
    const { lastFrame } = render(
      <ProgressLine
        currentStep={3}
        totalSteps={5}
        uniqueCompleted={2}
        totalExecuted={7}
      />
    );

    expect(lastFrame()).toContain('Step 3/5');
  });

  it('should show unique completed count', () => {
    const { lastFrame } = render(
      <ProgressLine
        currentStep={3}
        totalSteps={5}
        uniqueCompleted={2}
        totalExecuted={7}
      />
    );

    expect(lastFrame()).toContain('Completed: 2 unique');
  });

  it('should show total executed count', () => {
    const { lastFrame } = render(
      <ProgressLine
        currentStep={3}
        totalSteps={5}
        uniqueCompleted={2}
        totalExecuted={7}
      />
    );

    expect(lastFrame()).toContain('Total executed: 7');
  });

  it('should display loop iteration when provided', () => {
    const { lastFrame } = render(
      <ProgressLine
        currentStep={2}
        totalSteps={5}
        uniqueCompleted={3}
        totalExecuted={12}
        loopIteration={2}
      />
    );

    expect(lastFrame()).toContain('Iteration 2');
  });
});
