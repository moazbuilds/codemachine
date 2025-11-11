import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { PassThrough } from 'node:stream';
import { createKeyboardController } from '../../../src/cli/controllers/keyboard-controls';
import { renderExecutionScreen } from '../../../src/cli/presentation/typewriter';

describe('Keyboard controls', () => {
  let mockStdin: PassThrough & {
    isTTY?: boolean;
    setRawMode?: (v: boolean) => void;
    resume?: () => void;
    pause?: () => void;
  };

  beforeEach(() => {
    mockStdin = new PassThrough() as PassThrough & {
      isTTY?: boolean;
      setRawMode?: (v: boolean) => void;
      resume?: () => void;
      pause?: () => void;
    };
    mockStdin.isTTY = true;
    mockStdin.setRawMode = mock();
    spyOn(process, 'stdin', 'get').mockReturnValue(
      mockStdin as unknown as NodeJS.ReadStream,
    );
  });

  afterEach(() => {
    // stream cleanup
    mockStdin.removeAllListeners();
  });

  it('start()/stop() add/remove listeners; Ctrl+C twice emits interrupt then exit', () => {
    const kb = createKeyboardController();
    const events: { type: string; payload?: unknown }[] = [];
    kb.on('interrupt', (p) => events.push({ type: 'interrupt', payload: p }));
    kb.on('exit', (p) => events.push({ type: 'exit', payload: p }));

    // before start: no listeners
    expect(mockStdin.listenerCount('data')).toBe(0);

    const resumeSpy = spyOn(mockStdin, 'resume');
    const pauseSpy = spyOn(mockStdin, 'pause');

    kb.start();

    expect(mockStdin.setRawMode).toHaveBeenCalledWith(true);
    expect(resumeSpy).toHaveBeenCalled();
    expect(mockStdin.listenerCount('data')).toBe(1);

    // Ctrl+C -> interrupt
    mockStdin.write(Buffer.from([0x03]));
    expect(events[0]).toEqual({ type: 'interrupt', payload: { action: 'modify-artifacts' } });
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
    kb.on('toggle-expanded', (p: unknown) => toggles.push(!!(p as { expanded?: boolean })?.expanded));

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
    mock.useFakeTimers();
  });
  afterEach(() => {
    mock.useRealTimers();
  });

  it('streams using the default interval and mirrors to logger', async () => {
    const text = 'abcdef';
    const chunks: string[] = [];
    let logged = '';
    const handle = await renderExecutionScreen(text, {
      onChunk: (s) => chunks.push(s),
      logger: (s) => {
        logged += s;
      },
    });

    mock.advanceTimersByTime(1);
    expect(chunks.length).toBeGreaterThan(0);

    mock.advanceTimersByTime(50);
    expect(logged).toBe(text);

    handle.stop();
  });

  it('interval override: 8ms faster, 24ms slower vs default', async () => {
    const text = 'abcdefghijklmnopqrst'; // 20 chars to observe differences

    // Default interval (12ms) baseline
    const defaultChunks: string[] = [];
    const defaultHandle = await renderExecutionScreen(text, {
      intervalMs: 12,
      onChunk: (s) => defaultChunks.push(s),
      logger: () => {},
    });
    mock.advanceTimersByTime(24); // two ticks at 12ms
    const defaultCount = defaultChunks.length;
    expect(defaultCount).toBeGreaterThan(0);
    defaultHandle.stop();

    // Faster: 8ms
    const fastChunks: string[] = [];
    const fastHandle = await renderExecutionScreen(text, {
      intervalMs: 8,
      onChunk: (s) => fastChunks.push(s),
      logger: () => {},
    });
    mock.advanceTimersByTime(24);
    const fastCount = fastChunks.length;
    expect(fastCount).toBeGreaterThan(defaultCount);
    fastHandle.stop();

    // Slower: 24ms
    const slowChunks: string[] = [];
    const slowHandle = await renderExecutionScreen(text, {
      intervalMs: 24,
      onChunk: (s) => slowChunks.push(s),
      logger: () => {},
    });
    mock.advanceTimersByTime(24);
    const slowCount = slowChunks.length;
    expect(slowCount).toBeLessThan(defaultCount);
    slowHandle.stop();
  });

  it('stop() halts further emission', async () => {
    const text = 'abcd';
    const chunks: string[] = [];
    const handle = await renderExecutionScreen(text, {
      onChunk: (s) => chunks.push(s),
      logger: () => {},
    });

    mock.advanceTimersByTime(1);
    const afterFirstTick = chunks.length;
    expect(afterFirstTick).toBeGreaterThan(0);

    handle.stop();
    mock.advanceTimersByTime(100);
    expect(chunks.length).toBe(afterFirstTick);
  });
});
