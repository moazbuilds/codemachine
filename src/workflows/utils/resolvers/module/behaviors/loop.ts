import type { ModuleBehaviorConfig } from '../../../config/types.js';
import type { LoopBehaviorConfig, ModuleOverrides } from '../../../types.js';

export function resolveLoopBehavior(
  base: ModuleBehaviorConfig | undefined,
  overrides: ModuleOverrides,
): LoopBehaviorConfig | undefined {
  if (!base || base.type !== 'loop' || base.action !== 'stepBack') {
    return undefined;
  }

  const trigger = overrides.loopTrigger ?? (typeof base.trigger === 'string' ? base.trigger : undefined);
  if (!trigger || !trigger.trim()) {
    return undefined;
  }

  const overrideSteps = typeof overrides.loopSteps === 'number' ? overrides.loopSteps : undefined;
  const baseSteps = typeof base.steps === 'number' ? base.steps : undefined;
  const stepsCandidate = overrideSteps ?? baseSteps ?? 1;
  const steps = stepsCandidate > 0 ? Math.floor(stepsCandidate) : 1;
  const maxIterationsCandidate = overrides.loopMaxIterations ?? base.maxIterations;
  const maxIterations = typeof maxIterationsCandidate === 'number' && maxIterationsCandidate > 0
    ? Math.floor(maxIterationsCandidate)
    : undefined;

  return {
    type: 'loop',
    action: 'stepBack',
    steps,
    trigger,
    maxIterations,
    skip: overrides.loopSkip ?? base.skip,
  };
}
