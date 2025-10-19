import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { BrandingHeader } from '../../../src/ui/components/BrandingHeader';

describe('BrandingHeader', () => {
  it('should render workflow name and runtime', () => {
    const { lastFrame } = render(
      <BrandingHeader
        workflowName="Test Workflow"
        runtime="00:12:45"
        version="0.3.1"
        packageName="codemachine"
      />
    );

    expect(lastFrame()).toContain('Test Workflow');
    expect(lastFrame()).toContain('00:12:45');
  });

  it('should display version', () => {
    const { lastFrame } = render(
      <BrandingHeader
        workflowName="Test Workflow"
        runtime="00:00:05"
        version="0.3.1"
        packageName="codemachine"
      />
    );

    expect(lastFrame()).toContain('0.3.1');
  });

  it('should show CodeMachine branding', () => {
    const { lastFrame } = render(
      <BrandingHeader
        workflowName="Test Workflow"
        runtime="00:00:05"
        version="0.3.1"
        packageName="codemachine"
      />
    );

    expect(lastFrame()).toContain('CodeMachine');
  });
});
