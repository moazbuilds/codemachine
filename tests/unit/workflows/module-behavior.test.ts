import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { evaluateLoopBehavior } from '../../../src/workflows/behaviors/loop/evaluator.js';
import { resolveModule } from '../../../src/workflows/utils/index.js';

describe('workflow modules', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'module-behavior-test-'));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('resolveModule', () => {
    it('behavior is now controlled via behavior.json, not triggers', () => {
      const step = resolveModule('check-task');

      expect(step.agentName).toBe('Task Completion Checker');
      // Behavior is now always present for loop-enabled modules
      expect(step.module?.behavior).toBeDefined();
      expect(step.module?.behavior?.type).toBe('loop');
      // Trigger is optional - controlled via behavior.json
      expect(step.module?.behavior?.trigger).toBeUndefined();
    });

    it('applies loop configuration when provided by workflow overrides', () => {
      const step = resolveModule('check-task', {
        agentName: 'Tasks Complete Checker',
        loopSteps: 2,
        loopMaxIterations: 3,
      });

      expect(step.agentName).toBe('Tasks Complete Checker');
      expect(step.module?.behavior?.steps).toBe(2);
      expect(step.module?.behavior?.maxIterations).toBe(3);
    });
  });

  describe('evaluateLoopBehavior', () => {
    const baseBehavior = resolveModule('check-task').module?.behavior;

    it('returns null when no behavior is provided', async () => {
      const result = await evaluateLoopBehavior({
        behavior: undefined,
        output: 'TASKS_COMPLETED=FALSE',
        iterationCount: 0,
        cwd: tempDir,
      });

      expect(result).toBeNull();
    });

    it('detects loop action from behavior.json', async () => {
      expect(baseBehavior).toBeTruthy();

      // Create behavior.json file with loop action
      const behaviorDir = join(tempDir, '.codemachine', 'memory');
      const behaviorFile = join(behaviorDir, 'behavior.json');
      mkdirSync(behaviorDir, { recursive: true });
      writeFileSync(behaviorFile, JSON.stringify({ action: 'loop' }));

      const result = await evaluateLoopBehavior({
        behavior: baseBehavior,
        output: 'Tasks review completed',
        iterationCount: 0,
        cwd: tempDir,
      });

      expect(result).toMatchObject({ shouldRepeat: true, stepsBack: 1 });
    });

    it('detects stop action from behavior.json', async () => {
      expect(baseBehavior).toBeTruthy();

      // Create behavior.json file with stop action
      const behaviorDir = join(tempDir, '.codemachine', 'memory');
      const behaviorFile = join(behaviorDir, 'behavior.json');
      mkdirSync(behaviorDir, { recursive: true });
      writeFileSync(behaviorFile, JSON.stringify({ action: 'stop', reason: 'tasks completed' }));

      const result = await evaluateLoopBehavior({
        behavior: baseBehavior,
        output: 'TASKS_COMPLETED=TRUE\u001B[0m',
        iterationCount: 0,
        cwd: tempDir,
      });

      expect(result).toMatchObject({ shouldRepeat: false, stepsBack: 1, reason: 'tasks completed' });
    });

    it('returns null when no behavior.json file exists', async () => {
      expect(baseBehavior).toBeTruthy();
      const output = [
        'TASKS_COMPLETED=FALSE',
        '[2025-10-03T12:07:56] tokens used: 754',
      ].join('\n');
      const result = await evaluateLoopBehavior({
        behavior: baseBehavior,
        output,
        iterationCount: 0,
        cwd: tempDir,
      });

      // Without behavior.json, returns null
      expect(result).toBeNull();
    });

    it('uses catalog defaults when override omits optional values', () => {
      const behavior = resolveModule('check-task').module?.behavior;

      expect(behavior).toBeTruthy();
      expect(behavior?.steps).toBe(1);
      expect(behavior?.maxIterations).toBeUndefined();
    });

    it('returns null when behavior.json does not exist', async () => {
      expect(baseBehavior).toBeTruthy();
      const result = await evaluateLoopBehavior({
        behavior: baseBehavior,
        output: 'TASKS_COMPLETED=TRUE',
        iterationCount: 0,
        cwd: tempDir,
      });

      // Without behavior.json, returns null (not stopping)
      expect(result).toBeNull();
    });

    it('enforces max iteration limits when configured', async () => {
      const behaviorWithLimit = resolveModule('check-task', {
        loopMaxIterations: 3,
      }).module?.behavior;

      expect(behaviorWithLimit).toBeTruthy();

      // Create behavior.json file with loop action
      const behaviorDir = join(tempDir, '.codemachine', 'memory');
      const behaviorFile = join(behaviorDir, 'behavior.json');
      mkdirSync(behaviorDir, { recursive: true });
      writeFileSync(behaviorFile, JSON.stringify({ action: 'loop' }));

      const result = await evaluateLoopBehavior({
        behavior: behaviorWithLimit,
        output: 'TASKS_COMPLETED=FALSE',
        iterationCount: 3,
        cwd: tempDir,
      });

      expect(result).toMatchObject({ shouldRepeat: false, stepsBack: 1 });
      expect(result?.reason).toContain('loop limit');
    });

    it('handles engine formatted output with loop action from behavior.json', async () => {
      expect(baseBehavior).toBeTruthy();

      // Create behavior.json file with loop action
      const behaviorDir = join(tempDir, '.codemachine', 'memory');
      const behaviorFile = join(behaviorDir, 'behavior.json');
      mkdirSync(behaviorDir, { recursive: true });
      writeFileSync(behaviorFile, JSON.stringify({ action: 'loop' }));

      const output = [
        '💬 MESSAGE: TASKS_COMPLETED=FALSE',
        '⏱️  Tokens: 27012in/243out (11776 cached)',
      ].join('\n');
      const result = await evaluateLoopBehavior({
        behavior: baseBehavior,
        output,
        iterationCount: 0,
        cwd: tempDir,
      });

      expect(result).toMatchObject({ shouldRepeat: true, stepsBack: 1 });
    });

    it('handles output with thinking prefix followed by message', async () => {
      expect(baseBehavior).toBeTruthy();

      // Create behavior.json file with loop action
      const behaviorDir = join(tempDir, '.codemachine', 'memory');
      const behaviorFile = join(behaviorDir, 'behavior.json');
      mkdirSync(behaviorDir, { recursive: true });
      writeFileSync(behaviorFile, JSON.stringify({ action: 'loop' }));

      const output = [
        '🧠 THINKING: TASKS_COMPLETED=FALSE',
        '💬 MESSAGE: TASKS_COMPLETED=FALSE',
        '⏱️  Tokens: 27095in/294out (11776 cached)',
      ].join('\n');
      const result = await evaluateLoopBehavior({
        behavior: baseBehavior,
        output,
        iterationCount: 0,
        cwd: tempDir,
      });

      expect(result).toMatchObject({ shouldRepeat: true, stepsBack: 1 });
    });

    it('handles JSON telemetry lines', async () => {
      expect(baseBehavior).toBeTruthy();

      // Create behavior.json file with loop action
      const behaviorDir = join(tempDir, '.codemachine', 'memory');
      const behaviorFile = join(behaviorDir, 'behavior.json');
      mkdirSync(behaviorDir, { recursive: true });
      writeFileSync(behaviorFile, JSON.stringify({ action: 'loop' }));

      const output = [
        '💬 MESSAGE: TASKS_COMPLETED=FALSE',
        '⏱️  Tokens: 34153in/493out (11776 cached)',
        '{"type":"turn.completed","usage":{"input_tokens":22377,"cached_input_tokens":11776,"output_tokens":493}}',
      ].join('\n');
      const result = await evaluateLoopBehavior({
        behavior: baseBehavior,
        output,
        iterationCount: 0,
        cwd: tempDir,
      });

      expect(result).toMatchObject({ shouldRepeat: true, stepsBack: 1 });
    });
  });
});
