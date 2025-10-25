import type { UIStep } from '../types.js';

export function resolveUI(text: string): UIStep {
  return {
    type: 'ui',
    text,
  };
}
