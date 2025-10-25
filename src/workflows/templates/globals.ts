import { resolveFolder, resolveModule, resolveStep, resolveUI } from '../utils/index.js';

type TemplateGlobalProvider = typeof resolveStep | typeof resolveFolder | typeof resolveModule | typeof resolveUI;

const templateGlobals = {
  resolveStep,
  resolveFolder,
  resolveModule,
  resolveUI,
} satisfies Record<string, TemplateGlobalProvider>;

export function ensureTemplateGlobals(): void {
  const target = globalThis as unknown as Record<string, TemplateGlobalProvider | undefined>;
  for (const [key, fn] of Object.entries(templateGlobals)) {
    if (typeof target[key] !== 'function') {
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: false,
        writable: false,
        value: fn,
      });
    }
  }
}
