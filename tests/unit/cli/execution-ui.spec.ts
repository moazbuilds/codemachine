import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { createKeyboardController } from '../../../src/cli/controllers/keyboard-controls';
import { renderExecutionScreen } from '../../../src/cli/presentation/execution-screen';

describe('Keyboard controls', () => {
  let mockStdin: PassThrough & {
    isTTY?: boolean;
    setRawMode?: (v: boolean) => void;
    resume?: () => void;
    pause?: () => void;
  };

  beforeEach(() => {
    mockStdin = new PassThrough() as any;
    mockStdin.isTTY = true;
    mockStdin.setRawMode = vi.fn();
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(
      mockStdin as unknown as NodeJS.ReadStream,
    );
  });

  afterEach(() => {
    // stream cleanup
    mockStdin.removeAllListeners();
  });

  it('start()/stop() add/remove listeners; Ctrl+C twice emits interrupt then exit', () => {
    const kb = createKeyboardController();
    const events: { type: string; payload?: any }[] = [];
    kb.on('interrupt', (p) => events.push({ type: 'interrupt', payload: p }));
    kb.on('exit', (p) => events.push({ type: 'exit', payload: p }));

    // before start: no listeners
    expect(mockStdin.listenerCount('data')).toBe(0);

    const resumeSpy = vi.spyOn(mockStdin, 'resume');
    const pauseSpy = vi.spyOn(mockStdin, 'pause');

    kb.start();

    expect(mockStdin.setRawMode).toHaveBeenCalledWith(true);
    expect(resumeSpy).toHaveBeenCalled();
    expect(mockStdin.listenerCount('data')).toBe(1);

    // Ctrl+C -> interrupt
    mockStdin.write(Buffer.from([0x03]));
    expect(events[0]).toEqual({ type: 'interrupt', payload: { action: 'modify-plan' } });
    expect(kb.state.ctrlCount).toBe(1);

    // Ctrl+C again -> exit
    mockStdin.write(Buffer.from([0x03]));
    expect(events[1]).toEqual({ type: 'exit', payload: undefined });
    expect(kb.state.ctrlCount).toBe(2);

    kb.stop();
    expect(mockStdin.setRawMode).toHaveBeenCalledWith(false);
    expect(pauseSpy).toHaveBeenCalled();
    expect(mockStdin.listenerCount('data')).toBe(0);

    // After stop, no more events should be recorded
    mockStdin.write(Buffer.from([0x03]));
    expect(events.length).toBe(2);
  });

  it('Ctrl+E toggles expanded and emits event with state', () => {
    const kb = createKeyboardController();
    const toggles: boolean[] = [];
    kb.on('toggle-expanded', (p: any) => toggles.push(!!p?.expanded));

    kb.start();

    // Ctrl+E -> expanded true
    mockStdin.write(Buffer.from([0x05]));
    expect(kb.state.expanded).toBe(true);
    expect(toggles[toggles.length - 1]).toBe(true);

    // Ctrl+E -> expanded false
    mockStdin.write(Buffer.from([0x05]));
    expect(kb.state.expanded).toBe(false);
    expect(toggles[toggles.length - 1]).toBe(false);
  });
});

describe('Execution screen typewriter streaming', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('streams at default 12ms and mirrors to logger', async () => {
    const text = 'abcdef';
    const chunks: string[] = [];
    let logged = '';
    const handle = await renderExecutionScreen(text, {
      onChunk: (s) => chunks.push(s),
      logger: (s) => {
        logged += s;
      },
    });

    // After 36ms, expect 3 chunks (12ms each)
    vi.advanceTimersByTime(36);
    expect(chunks.length).toBe(3);

    // Finish streaming
    vi.advanceTimersByTime(200);
    expect(logged).toBe(text);

    handle.stop();
  });

  it('interval override: 8ms faster, 24ms slower vs default', async () => {
    const text = 'abcdefghij'; // 10 chars

    // Default 12ms
    const defaultChunks: string[] = [];
    await renderExecutionScreen(text, {
      onChunk: (s) => defaultChunks.push(s),
      logger: () => {},
    });

    // After 48ms -> ~4 chars at 12ms
    vi.advanceTimersByTime(48);
    const defaultCount = defaultChunks.length;
    expect(defaultCount).toBe(4);

    // Faster: 8ms
    const fastChunks: string[] = [];
    await renderExecutionScreen(text, {
      intervalMs: 8,
      onChunk: (s) => fastChunks.push(s),
      logger: () => {},
    });
    vi.advanceTimersByTime(48);
    const fastCount = fastChunks.length;
    expect(fastCount).toBeGreaterThan(defaultCount); // > 4

    // Slower: 24ms
    const slowChunks: string[] = [];
    await renderExecutionScreen(text, {
      intervalMs: 24,
      onChunk: (s) => slowChunks.push(s),
      logger: () => {},
    });
    vi.advanceTimersByTime(48);
    const slowCount = slowChunks.length;
    expect(slowCount).toBeLessThan(defaultCount); // < 4
  });

  it('stop() halts further emission', async () => {
    const text = 'abcd';
    const chunks: string[] = [];
    const handle = await renderExecutionScreen(text, {
      onChunk: (s) => chunks.push(s),
      logger: () => {},
    });

    vi.advanceTimersByTime(12);
    expect(chunks.length).toBe(1);

    handle.stop();
    vi.advanceTimersByTime(100);
    expect(chunks.length).toBe(1);
  });
});
