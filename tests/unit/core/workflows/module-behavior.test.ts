import { describe, expect, it } from 'vitest';

import { evaluateLoopBehavior } from '../../../../src/core/workflows/modules/loop-behavior.ts';
import { resolveModule } from '../../../../src/core/workflows/workflow-utils.ts';

describe('workflow modules', () => {
  describe('resolveModule', () => {
    it('requires the trigger to come from workflow overrides', () => {
      const step = resolveModule('check-task');

      expect(step.agentName).toBe('Check Task');
      expect(step.module?.behavior).toBeUndefined();
    });

    it('applies loop configuration when provided by workflow overrides', () => {
      const step = resolveModule('check-task', {
        agentName: 'Tasks Complete Checker',
        loopTrigger: 'TASKS_COMPLETED=FALSE',
        loopSteps: 2,
        loopMaxIterations: 3,
      });

      expect(step.agentName).toBe('Tasks Complete Checker');
      expect(step.module?.behavior?.steps).toBe(2);
      expect(step.module?.behavior?.maxIterations).toBe(3);
    });
  });

  describe('evaluateLoopBehavior', () => {
    const baseBehavior = resolveModule('check-task', {
      loopTrigger: 'TASKS_COMPLETED=FALSE',
    }).module?.behavior;

    it('returns null when no behavior is provided', () => {
      const result = evaluateLoopBehavior({
        behavior: undefined,
        output: 'TASKS_COMPLETED=FALSE',
        iterationCount: 0,
      });

      expect(result).toBeNull();
    });

    it('detects trigger match and requests loop', () => {
      expect(baseBehavior).toBeTruthy();
      const result = evaluateLoopBehavior({
        behavior: baseBehavior,
        output: 'Tasks review completed TASKS_COMPLETED=FALSE',
        iterationCount: 0,
      });

      expect(result).toMatchObject({ shouldRepeat: true, stepsBack: 1 });
    });

    it('strips ANSI sequences when evaluating triggers', () => {
      expect(baseBehavior).toBeTruthy();
      const result = evaluateLoopBehavior({
        behavior: baseBehavior,
        output: 'TASKS_COMPLETED=FALSE\u001B[0m',
        iterationCount: 0,
      });

      expect(result).toMatchObject({ shouldRepeat: true, stepsBack: 1 });
    });

    it('ignores telemetry lines appended after the trigger', () => {
      expect(baseBehavior).toBeTruthy();
      const output = [
        'TASKS_COMPLETED=FALSE',
        '[2025-10-03T12:07:56] tokens used: 754',
      ].join('\n');
      const result = evaluateLoopBehavior({
        behavior: baseBehavior,
        output,
        iterationCount: 0,
      });

      expect(result).toMatchObject({ shouldRepeat: true, stepsBack: 1 });
    });

    it('uses catalog defaults when override omits optional values', () => {
      const behavior = resolveModule('check-task', {
        loopTrigger: 'TASKS_COMPLETED=FALSE',
      }).module?.behavior;

      expect(behavior).toBeTruthy();
      expect(behavior?.steps).toBe(1);
      expect(behavior?.maxIterations).toBeUndefined();
    });

    it('ignores trigger when it does not match last token', () => {
      expect(baseBehavior).toBeTruthy();
      const result = evaluateLoopBehavior({
        behavior: baseBehavior,
        output: 'TASKS_COMPLETED=TRUE',
        iterationCount: 0,
      });

      expect(result).toEqual({ shouldRepeat: false, stepsBack: 1 });
    });

    it('enforces max iteration limits when configured', () => {
      const behaviorWithLimit = resolveModule('check-task', {
        loopTrigger: 'TASKS_COMPLETED=FALSE',
        loopMaxIterations: 3,
      }).module?.behavior;

      expect(behaviorWithLimit).toBeTruthy();
      const result = evaluateLoopBehavior({
        behavior: behaviorWithLimit,
        output: 'TASKS_COMPLETED=FALSE',
        iterationCount: 3,
      });

      expect(result).toMatchObject({ shouldRepeat: false, stepsBack: 1 });
      expect(result?.reason).toContain('loop limit');
    });
  });
});
