import type { UIStep } from '../../templates/types.js';

export function resolveUI(text: string): UIStep {
  return {
    type: 'ui',
    text,
  };
}
