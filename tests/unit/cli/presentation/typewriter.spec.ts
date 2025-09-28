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

  it('writes characters in order using the default interval', async () => {
    const writer = vi.fn();
    const promise = renderTypewriter({ text: 'CLI', writer });

    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer).toHaveBeenNthCalledWith(1, 'C');

    await vi.advanceTimersByTimeAsync(11);
    expect(writer).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(writer).toHaveBeenCalledTimes(2);
    expect(writer).toHaveBeenNthCalledWith(2, 'L');

    await vi.advanceTimersByTimeAsync(12);
    expect(writer).toHaveBeenCalledTimes(3);
    expect(writer).toHaveBeenNthCalledWith(3, 'I');

    await promise;
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
    const promise = renderTypewriter({ text: 'hi', writer, intervalMs: 20 });

    expect(writer).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(19);
    expect(writer).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(writer).toHaveBeenCalledTimes(2);

    await promise;
  });

  it('resolves immediately when text is empty', async () => {
    const writer = vi.fn();

    await renderTypewriter({ text: '', writer });

    expect(writer).not.toHaveBeenCalled();
  });
});
