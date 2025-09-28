import { EventEmitter } from 'node:events';

type Events = 'interrupt' | 'exit' | 'toggle-expanded';

export interface KeyboardController {
  on(event: Events, fn: (payload?: unknown) => void): void;
  off(event: Events, fn: (payload?: unknown) => void): void;
  start(): void;
  stop(): void;
  state: {
    ctrlCount: number;
    expanded: boolean;
  };
}

export function createKeyboardController(): KeyboardController {
  const emitter = new EventEmitter();
  const state = {
    ctrlCount: 0,
    expanded: false,
  };

  const dataListener = (data: Buffer) => {
    const code = data[0];
    // Ctrl+C (ETX)
    if (code === 0x03) {
      state.ctrlCount += 1;
      if (state.ctrlCount === 1) {
        emitter.emit('interrupt', { action: 'modify-plan' });
      } else {
        emitter.emit('exit');
      }
      return;
    }

    // Ctrl+E (ENQ)
    if (code === 0x05) {
      state.expanded = !state.expanded;
      emitter.emit('toggle-expanded', { expanded: state.expanded });
      return;
    }
  };

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    const stdin: NodeJS.ReadStream = process.stdin as unknown as NodeJS.ReadStream;
    if (stdin.isTTY && typeof (stdin as any).setRawMode === 'function') {
      (stdin as any).setRawMode(true);
    }
    if (typeof stdin.resume === 'function') {
      stdin.resume();
    }
    stdin.on('data', dataListener);
  };

  const stop = () => {
    if (!started) return;
    started = false;
    const stdin: NodeJS.ReadStream = process.stdin as unknown as NodeJS.ReadStream;
    stdin.off('data', dataListener);
    if (stdin.isTTY && typeof (stdin as any).setRawMode === 'function') {
      (stdin as any).setRawMode(false);
    }
    if (typeof stdin.pause === 'function') {
      stdin.pause();
    }
  };

  return {
    on: (event, fn) => emitter.on(event, fn),
    off: (event, fn) => emitter.off(event, fn),
    start,
    stop,
    state,
  };
}

