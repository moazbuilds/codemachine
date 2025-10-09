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

if (!process.env.CODEMACHINE_SKIP_ENGINE) {
  process.env.CODEMACHINE_SKIP_ENGINE = '1';
}

if (!process.env.CODEMACHINE_SKIP_AUTH) {
  process.env.CODEMACHINE_SKIP_AUTH = '1';
}

afterEach(() => {
  vi.restoreAllMocks();
});
