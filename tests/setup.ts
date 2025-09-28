import { TextDecoder, TextEncoder } from 'util';
import { afterEach, vi } from 'vitest';

const globalScope = globalThis as typeof globalThis & {
  TextEncoder?: typeof TextEncoder;
  TextDecoder?: typeof TextDecoder;
};

if (!globalScope.TextEncoder) {
  globalScope.TextEncoder = TextEncoder;
}

if (!globalScope.TextDecoder) {
  globalScope.TextDecoder = TextDecoder;
}

afterEach(() => {
  vi.restoreAllMocks();
});
