import { describe, expect, it } from 'bun:test';

import {
  banner,
  divider,
  formatKeyValue,
  palette,
  section,
} from '../../../../src/cli/presentation/layout.js';

describe('layout helpers', () => {
  it('creates a styled banner with top and bottom borders', () => {
    const title = 'Codemachine';
    const border = palette.primary.bold(divider('═'));
    const heading = palette.primary.bold(` ${title} `);

    expect(banner(`  ${title}  `)).toBe(`${border}\n${heading}\n${border}`);
  });

  it('creates an uppercased section header with underline', () => {
    const heading = palette.secondary.bold('SETUP');
    const underline = palette.secondary(divider());

    expect(section('Setup')).toBe(`${heading}\n${underline}`);
  });

  it('formats key value pairs with fixed gutter width', () => {
    const label = palette.secondary('Profile:'.padEnd(24, ' '));

    expect(formatKeyValue('Profile', 'dev')).toBe(`${label}dev`);
  });

  it('builds dividers with custom characters and widths', () => {
    expect(divider()).toBe('─'.repeat(60));
    expect(divider('*', 10)).toBe('*'.repeat(10));
    expect(divider('#', 0)).toBe('');
  });
});
