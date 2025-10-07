import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderTypewriter } from '../../../../src/cli/presentation/typewriter.js';

describe('renderTypewriter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('writes characters in batches using the default interval', async () => {
    const writer = vi.fn();
    await renderTypewriter({ text: 'CLI', writer });

    expect(writer).toHaveBeenCalledTimes(3);
    expect(writer.mock.calls.map((call) => call[0]).join('')).toBe('CLI');
  });

  it('invokes onChunk callback for each character with index', async () => {
    const onChunk = vi.fn();
    const promise = renderTypewriter({ text: 'ok', onChunk, writer: vi.fn() });

    await vi.advanceTimersByTimeAsync(12);
    await promise;

    expect(onChunk.mock.calls).toEqual([
      ['o', 0],
      ['k', 1],
    ]);
  });

  it('applies custom interval when provided', async () => {
    const writer = vi.fn();
    const promise = renderTypewriter({ text: 'abcdefghij', writer, intervalMs: 20 });

    // First batch of five characters is written immediately.
    expect(writer).toHaveBeenCalledTimes(5);
    expect(writer.mock.calls.slice(0, 5).map((call) => call[0]).join('')).toBe('abcde');

    await vi.advanceTimersByTimeAsync(19);
    expect(writer).toHaveBeenCalledTimes(5);

    await vi.advanceTimersByTimeAsync(1);
    await promise;

    expect(writer).toHaveBeenCalledTimes(10);
    expect(writer.mock.calls.map((call) => call[0]).join('')).toBe('abcdefghij');
  });

  it('resolves immediately when text is empty', async () => {
    const writer = vi.fn();

    await renderTypewriter({ text: '', writer });

    expect(writer).not.toHaveBeenCalled();
  });
});
