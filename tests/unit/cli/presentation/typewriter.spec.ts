import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { renderTypewriter } from '../../../../src/cli/presentation/typewriter.js';

describe('renderTypewriter', () => {
  beforeEach(() => {
    mock.useFakeTimers();
  });

  afterEach(() => {
    mock.useRealTimers();
    mock.restore();
  });

  it('writes characters in batches using the default interval', async () => {
    const writer = mock();
    await renderTypewriter({ text: 'CLI', writer });

    expect(writer).toHaveBeenCalledTimes(3);
    expect(writer.mock.calls.map((call) => call[0]).join('')).toBe('CLI');
  });

  it('invokes onChunk callback for each character with index', async () => {
    const onChunk = mock();
    const promise = renderTypewriter({ text: 'ok', onChunk, writer: mock() });

    await mock.advanceTimersByTimeAsync(12);
    await promise;

    expect(onChunk.mock.calls).toEqual([
      ['o', 0],
      ['k', 1],
    ]);
  });

  it('applies custom interval when provided', async () => {
    const writer = mock();
    const promise = renderTypewriter({ text: 'abcdefghij', writer, intervalMs: 20 });

    // First batch of five characters is written immediately.
    expect(writer).toHaveBeenCalledTimes(5);
    expect(writer.mock.calls.slice(0, 5).map((call) => call[0]).join('')).toBe('abcde');

    await mock.advanceTimersByTimeAsync(19);
    expect(writer).toHaveBeenCalledTimes(5);

    await mock.advanceTimersByTimeAsync(1);
    await promise;

    expect(writer).toHaveBeenCalledTimes(10);
    expect(writer.mock.calls.map((call) => call[0]).join('')).toBe('abcdefghij');
  });

  it('resolves immediately when text is empty', async () => {
    const writer = mock();

    await renderTypewriter({ text: '', writer });

    expect(writer).not.toHaveBeenCalled();
  });
});
