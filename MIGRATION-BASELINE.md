# Bun Migration Baseline - Phase 1

## Test Results (Pre-Migration with pnpm)

**Date**: 2025-11-11
**Package Manager**: pnpm v10.17.1
**Test Runner**: vitest v3.2.4

### Test Summary
- **Test Files**: 1 failed | 33 passed | 1 skipped (35 total)
- **Tests**: 229 passed | 25 skipped (254 total)
- **Duration**: 13.98s

### Failed Test
- `tests/e2e/start-cli.spec.ts`: Hook timeout (requires build artifacts - will be resolved during migration)

### Test Breakdown by File
- ✓ heightCalculations.test.ts (22 tests) - 137ms
- ✓ workflow steps.spec.ts (9 tests) - 273ms
- ✓ execution-ui.spec.ts (5 tests) - 65ms
- ✓ WorkflowUIState.test.ts (14 tests) - 143ms
- ✓ module-behavior.test.ts (12 tests) - 77ms
- ✓ types.test.ts (9 tests) - 118ms
- ✓ performance.test.ts (10 tests) - 323ms
- ✓ TriggeredAgentList.test.tsx (8 tests) - 232ms
- ✓ SubAgentList.test.tsx (7 tests) - 220ms
- ✓ workflow-ui-manager.test.ts (11 tests | 4 skipped) - 29ms
- ✓ telemetryParser.test.ts (11 tests) - 23ms
- ✓ edge-cases.test.ts (16 tests | 9 skipped) - 33ms
- ✓ full-workflow.test.ts (6 tests | 5 skipped) - 17ms
- ✓ outputProcessor.test.ts (11 tests) - 58ms
- ↓ useTerminalResize.test.tsx (6 tests | 6 skipped)
- ✓ formatters.test.ts (16 tests) - 64ms
- ✓ SubAgentSummary.test.tsx (6 tests) - 105ms
- ✓ MainAgentNode.test.tsx (6 tests) - 142ms
- ✓ TelemetryBar.test.tsx (6 tests) - 239ms
- ✓ ccr-command-builder.spec.ts (5 tests) - 18ms
- ✓ ccr-engine.spec.ts (7 tests) - 42ms
- ✓ ccr-executor.spec.ts (5 tests) - 34ms
- ✓ memory-store.spec.ts (4 tests) - 117ms
- ✓ statusIcons.test.ts (8 tests) - 12ms
- ✓ engine-runner.spec.ts (3 tests) - 38ms
- ✓ layout.spec.ts (4 tests) - 19ms
- ✓ LoopIndicator.test.tsx (4 tests) - 333ms
- ✓ workspace-init.spec.ts (5 tests) - 2529ms
- ✓ BrandingHeader.test.tsx (3 tests) - 91ms
- ✓ StatusFooter.test.tsx (1 test) - 104ms
- ❯ start-cli.spec.ts (1 test | 1 skipped) - FAILED (timeout)
- ✓ ccr-registry.spec.ts (5 tests) - 79ms
- ✓ planning-workflow.spec.ts (2 tests) - 28ms
- ✓ register-cli.spec.ts (2 tests) - 16ms

### Success Criteria for Phase 1
After migration to Bun, we expect:
- ✅ Same or better test pass rate (229 passed minimum)
- ✅ No new test failures beyond the known e2e/start-cli.spec.ts timeout
- ✅ All test files execute successfully with Bun test runner
