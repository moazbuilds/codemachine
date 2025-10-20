import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { BrandingHeader } from '../../../src/ui/components/BrandingHeader';

describe('BrandingHeader', () => {
  it('should display ASCII art branding', () => {
    const { lastFrame } = render(
      <BrandingHeader
        version="0.3.1"
        currentDir="/home/user/projects/codemachine"
      />
    );

    expect(lastFrame()).toContain('_____');
    expect(lastFrame()).toContain('|     |___');
  });

  it('should display version', () => {
    const { lastFrame } = render(
      <BrandingHeader
        version="0.3.1"
        currentDir="/home/user/projects/codemachine"
      />
    );

    expect(lastFrame()).toContain('v0.3.1');
  });

  it('should display current directory', () => {
    const { lastFrame } = render(
      <BrandingHeader
        version="0.3.1"
        currentDir="/home/user/projects/codemachine"
      />
    );

    expect(lastFrame()).toContain('/home/user/projects/codemachine');
  });
});
