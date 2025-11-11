# Bun Migration Plan for CodeMachine

**Version 1.1** | **Last Updated:** 2025-11-11 | **Status:** Ready for execution

> 📋 **Related Documents:**
> - `02-bun-migration-ui-risk-analysis.md` - Detailed UI migration risks and testing results
> - `03-bun-migration-results.md` - Post-migration results (to be created)

---

## Table of Contents
1. [Overview](#overview)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Migration Phases](#migration-phases)
4. [Rollback Plan](#rollback-plan)
5. [Expected Outcomes](#expected-outcomes)
6. [References](#references)

---

## Overview

### What is Being Migrated?

This migration plan transitions CodeMachine from Node.js-based tooling to Bun, a modern all-in-one JavaScript runtime and toolkit.

### What Bun Replaces

| Current Tool | Purpose | Bun Replacement |
|-------------|---------|-----------------|
| **tsup** (v8.5.0) | TypeScript bundler | `bun build` ✅ |
| **tsx** (v4.7.2) | TypeScript runtime (dev) | `bun` runtime ⚠️ |
| **node** | JavaScript runtime (prod) | `bun` runtime ✅ |
| **vitest** (v3.2.4) | Test runner | `bun test` ✅ |
| **@vitest/coverage-v8** | Code coverage | Built into `bun test` ✅ |
| **cross-spawn** (v7.0.6) | Process spawning | `Bun.spawn()` API ✅ |
| **execa** (v9.6.0) | Process execution | `Bun.spawn()` API ✅ |
| **pnpm/npm** | Package manager | `bun` package manager ✅ |

⚠️ **Important Note on tsx:** Due to UI-related risks (module resolution and native dependencies), tsx will be **kept for UI development** initially. Production builds will use Bun. See `docs/02-bun-migration-ui-risk-analysis.md` for details.

### What Stays

- **tsx** - Temporarily kept for UI development (Phase 8 will attempt migration)
- **TypeScript (tsc)** - For `.d.ts` generation and strict type checking
- **ESLint** - Linting (executed via `bun run lint`)
- **Prettier** - Code formatting (executed via `bun run format`)
- **React/Ink** - UI framework (Bun supports natively)
- **Husky** - Git hooks (runtime-agnostic)
- All application dependencies (chalk, commander, zod, etc.)

### Expected Performance Gains

- **Install time:** 10-20x faster
- **Build time:** 2-5x faster
- **Test execution:** 2-4x faster
- **Runtime performance:** 1.5-3x faster
- **Dev startup:** Near-instant TypeScript transpilation

---

## Pre-Migration Checklist

### 1. Environment Setup

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version  # Should be >= 1.0.0
```

### 2. Create Backup Branch

```bash
git checkout -b backup/pre-bun-migration
git push origin backup/pre-bun-migration

git checkout main
git checkout -b feature/bun-migration
```

### 3. Document Current State

```bash
# Save current dependency lockfiles
cp package-lock.json package-lock.json.backup
cp pnpm-lock.yaml pnpm-lock.yaml.backup

# Run tests to establish baseline
pnpm test > test-results-before.txt 2>&1

# Document current build output
pnpm build
ls -lah dist/ > dist-before.txt
```

### 4. Review Key Files

Ensure you understand these files (already analyzed):
- ✅ `package.json` - Scripts and dependencies
- ✅ `src/infra/process/spawn.ts` - Process spawning logic
- ✅ `vitest.config.ts` - Test configuration
- ✅ `tsconfig.json` - TypeScript configuration
- ✅ `scripts/validate.mjs` - Validation script
- ✅ `scripts/publish.mjs` - Publishing script

---

## Migration Phases

## Phase 1: Package Manager Migration

**Goal:** Replace pnpm/npm with Bun as the package manager.

### Step 1.1: Clean Current Dependencies

```bash
# Remove old lockfiles
rm package-lock.json pnpm-lock.yaml

# Remove node_modules
rm -rf node_modules
```

### Step 1.2: Install with Bun

```bash
# Install all dependencies with Bun
bun install

# Verify installation
bun --version
ls -lah bun.lockb  # Binary lockfile created
```

### Step 1.3: Verify Dependencies

```bash
# Check if all dependencies are installed correctly
bun pm ls

# Try running existing scripts with bun
bun run build
bun run typecheck
```

### Step 1.4: Update Package.json Scripts (Part 1)

Update `package.json` to prefer Bun for basic commands:

```json
{
  "scripts": {
    "start": "bun run build && bun dist/index.js",
    "validate": "bun scripts/validate.mjs",
    "release": "bun scripts/publish.mjs --tag latest"
  }
}
```

**Validation:**
```bash
bun install --frozen-lockfile  # Should work without errors
```

**Rollback:** Restore old lockfiles and run `pnpm install`

---

## Phase 2: Build Tooling Migration

**Goal:** Replace tsup with Bun's native bundler.

### Step 2.1: Test Bun Build

First, test Bun's build without changing package.json:

```bash
# Test basic build
bun build src/runtime/index.ts --outdir dist --target node --format esm --sourcemap

# Check output
ls -lah dist/
file dist/index.js  # Should be JavaScript file
```

### Step 2.2: Generate Type Declarations

Since Bun doesn't generate `.d.ts` files, keep TypeScript for this:

```bash
# Generate declaration files
tsc --emitDeclarationOnly --outDir dist
```

### Step 2.3: Create Build Script

Create `scripts/build.mjs`:

```javascript
#!/usr/bin/env bun
import { $ } from 'bun';

console.log('[build] Building with Bun...');

// Bundle with Bun
await $`bun build src/runtime/index.ts --outdir dist --target node --format esm --sourcemap --minify`;

console.log('[build] Generating type declarations...');

// Generate .d.ts files with TypeScript
await $`tsc --emitDeclarationOnly --outDir dist`;

console.log('[build] Build complete!');
```

Make it executable:

```bash
chmod +x scripts/build.mjs
```

### Step 2.4: Update Package.json Scripts

```json
{
  "scripts": {
    "build": "bun scripts/build.mjs"
  }
}
```

### Step 2.5: Remove tsup

```bash
bun remove tsup
```

**Validation:**
```bash
rm -rf dist
bun run build
ls -lah dist/  # Should have index.js, index.js.map, and .d.ts files
node dist/index.js --help  # Should work (Node compatibility check)
bun dist/index.js --help  # Should work
```

**Rollback:** `bun add -d tsup` and restore old build script

---

## Phase 3: Runtime Migration

**Goal:** Replace node with Bun runtime for production. **Keep tsx for UI development** due to identified risks.

⚠️ **IMPORTANT:** See `docs/02-bun-migration-ui-risk-analysis.md` for detailed UI migration risks. The UI has blocking issues with Bun (module resolution errors, native dependency concerns). We'll use a **dual runtime approach** where tsx handles UI development and Bun handles everything else.

### Step 3.1: Update Scripts (Conservative Approach)

Update `package.json` to use Bun for production and tsx for development:

```json
{
  "scripts": {
    "dev": "DEBUG=true tsx src/runtime/cli-setup.ts",
    "dev:bun": "DEBUG=true bun src/runtime/cli-setup.ts",
    "debug": "REACT_DEVTOOLS=1 DEBUG=\"ink:*\" tsx src/runtime/cli-setup.ts",
    "start": "bun run build && bun dist/index.js"
  }
}
```

**Rationale:**
- `dev`: Keep tsx (UI works, no risks)
- `dev:bun`: Experimental Bun version (for testing)
- `start`: Production uses Bun (no interactive UI)

### Step 3.2: Test Bun Runtime (Non-UI)

Test Bun runtime with production build:

```bash
# Build with Bun
bun run build

# Test production binary with Bun
bun dist/index.js --help
bun dist/index.js --version

# Test direct execution (uses shebang)
./dist/index.js --help
```

### Step 3.3: Test UI in Bun (Experimental)

**Expected Result:** Will likely fail due to module resolution issues.

```bash
# Try running UI in Bun
bun run dev:bun

# Expected error:
# error: Cannot find module './cjs/index.cjs' from ''
```

If it works (unlikely with current Bun v1.3.2), great! If not, that's expected and documented.

### Step 3.4: Update Binary Shebang

The production binary (`dist/index.js`) should use Node-compatible shebang for maximum compatibility:

```javascript
#!/usr/bin/env node
```

This allows the binary to run with either Node.js or Bun.

### Step 3.5: Do NOT Remove tsx

**❌ DO NOT run:** `bun remove tsx`

tsx is still needed for UI development. We'll revisit removing it in Phase 8 (UI migration).

**Validation:**
```bash
# Development with tsx (should work perfectly)
bun run dev  # Uses tsx
# Press Ctrl+C to exit

# Production with Bun (should work)
bun dist/index.js --version

# Experimental Bun dev (will likely fail)
bun run dev:bun  # Expected to fail with module resolution error
```

**Success Criteria:**
- ✅ Production build runs with Bun
- ✅ Development still works with tsx
- ⚠️ Bun dev mode may fail (expected, will fix in Phase 8)

**Rollback:** Just restore old package.json scripts

---

## Phase 4: Test Runner Migration

**Goal:** Replace Vitest with Bun's built-in test runner.

### Step 4.1: Analyze Current Tests

```bash
# Find all test files
find tests -name "*.spec.ts" -o -name "*.test.ts" | wc -l

# Check test structure
head -n 20 tests/unit/workflows/steps.spec.ts
```

### Step 4.2: Create Bun Test Configuration

Create `bunfig.toml` (Bun's config file):

```toml
[test]
# Test environment
preload = ["./tests/setup.ts"]

# Coverage settings
coverage = true
coverageReporter = ["text", "lcov", "html"]
coverageDir = "./coverage"

# Exclude patterns
coverageSkipTestFiles = true
```

### Step 4.3: Update Test Setup File

Review `tests/setup.ts` and ensure it's compatible with Bun. Most Vitest APIs are compatible, but check for:

- Global test functions (describe, it, expect) - Bun provides these
- Mock functions - Bun has `mock()` API
- Setup/teardown hooks - Bun supports beforeAll, afterAll, etc.

### Step 4.4: Update Package.json Scripts

```json
{
  "scripts": {
    "test": "bun test --coverage",
    "test:watch": "bun test --watch"
  }
}
```

### Step 4.5: Run Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/unit/workflows/steps.spec.ts

# Watch mode
bun test --watch
```

### Step 4.6: Fix Test Incompatibilities

Common issues and fixes:

**Issue 1: Import statements**
```typescript
// Vitest
import { describe, it, expect } from 'vitest';

// Bun (globals available, no import needed)
// Just remove the import or use:
import { describe, it, expect } from 'bun:test';
```

**Issue 2: Mock functions**
```typescript
// Vitest
import { vi } from 'vitest';
const mockFn = vi.fn();

// Bun
import { mock } from 'bun:test';
const mockFn = mock();
```

**Issue 3: Testing library compatibility**
```typescript
// Both work the same
import { render } from '@testing-library/react';
import { render as renderInk } from 'ink-testing-library';
```

### Step 4.7: Remove Vitest

```bash
bun remove vitest @vitest/coverage-v8
rm vitest.config.ts
```

### Step 4.8: Update TypeScript Config

Remove vitest types from `tests/tsconfig.json` if present:

```json
{
  "compilerOptions": {
    "types": ["node", "react", "bun-types"]  // Add bun-types
  }
}
```

Install bun types:
```bash
bun add -d @types/bun
```

**Validation:**
```bash
bun test  # All tests should pass
bun test --coverage  # Coverage report should generate
```

**Rollback:** `bun add -d vitest @vitest/coverage-v8` and restore vitest.config.ts

---

## Phase 5: Process Spawning Refactor

**Goal:** Replace cross-spawn and execa with Bun.spawn().

### Step 5.1: Analyze Current Implementation

Key file: `src/infra/process/spawn.ts`

Key features to preserve:
- Process group management (detached processes)
- Abort signal support
- Stdin/stdout/stderr piping
- Timeout handling
- Cross-platform compatibility (Windows)
- Active process tracking

### Step 5.2: Create New Spawn Implementation

Create `src/infra/process/spawn-bun.ts`:

```typescript
import type { Subprocess } from 'bun';
import * as logger from '../../shared/logging/logger.js';

export interface SpawnOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  signal?: AbortSignal;
  stdioMode?: 'pipe' | 'inherit';
  timeout?: number;
  stdinInput?: string;
}

export interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const activeProcesses = new Set<Subprocess>();

export function killAllActiveProcesses(): void {
  for (const child of activeProcesses) {
    try {
      child.kill();
    } catch {
      // Ignore errors during cleanup
    }
  }
  activeProcesses.clear();
}

export function spawnProcess(options: SpawnOptions): Promise<SpawnResult> {
  const {
    command,
    args = [],
    cwd,
    env,
    onStdout,
    onStderr,
    signal,
    stdioMode = 'pipe',
    timeout,
    stdinInput,
  } = options;

  return new Promise((resolve, reject) => {
    let wasAborted = false;
    let timeoutId: Timer | undefined;

    // Build Bun spawn options
    const spawnOptions: Parameters<typeof Bun.spawn>[1] = {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: stdioMode === 'inherit' ? ['inherit', 'inherit', 'inherit'] : ['pipe', 'pipe', 'pipe'],
    };

    // Spawn process
    const proc = Bun.spawn([command, ...args], spawnOptions);
    activeProcesses.add(proc);

    const removeFromTracking = () => {
      activeProcesses.delete(proc);
      if (timeoutId) clearTimeout(timeoutId);
    };

    // Handle abort signal
    if (signal) {
      const abortHandler = () => {
        logger.debug(`Abort handler called for ${command}`);
        wasAborted = true;
        proc.kill();
      };

      if (signal.aborted) {
        abortHandler();
      } else {
        signal.addEventListener('abort', abortHandler, { once: true });
      }
    }

    // Handle timeout
    if (timeout) {
      timeoutId = setTimeout(() => {
        logger.debug(`Timeout reached for ${command}`);
        wasAborted = true;
        proc.kill();
      }, timeout);
    }

    // Handle stdin
    if (proc.stdin && stdinInput !== undefined) {
      proc.stdin.write(stdinInput);
      proc.stdin.end();
    } else if (proc.stdin && stdioMode === 'pipe') {
      proc.stdin.end();
    }

    // Collect output
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    // Stream stdout
    if (stdioMode === 'pipe' && proc.stdout) {
      (async () => {
        for await (const chunk of proc.stdout) {
          const text = Buffer.from(chunk).toString();
          stdoutChunks.push(text);
          onStdout?.(text);
        }
      })();
    }

    // Stream stderr
    if (stdioMode === 'pipe' && proc.stderr) {
      (async () => {
        for await (const chunk of proc.stderr) {
          const text = Buffer.from(chunk).toString();
          stderrChunks.push(text);
          onStderr?.(text);
        }
      })();
    }

    // Wait for process to exit
    proc.exited.then((exitCode) => {
      logger.debug(`Process exited: ${command}, code: ${exitCode}, wasAborted: ${wasAborted}`);
      removeFromTracking();

      if (wasAborted) {
        reject(signal?.reason || new Error('Process aborted'));
        return;
      }

      resolve({
        exitCode,
        stdout: stdoutChunks.join(''),
        stderr: stderrChunks.join(''),
      });
    }).catch((error) => {
      logger.debug(`Process error: ${command}`, error);
      removeFromTracking();
      reject(error);
    });
  });
}
```

### Step 5.3: Test New Implementation

Create a test file `tests/unit/infra/spawn-bun.spec.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { spawnProcess } from '../../../src/infra/process/spawn-bun.js';

describe('spawnProcess (Bun)', () => {
  it('should execute simple command', async () => {
    const result = await spawnProcess({
      command: 'echo',
      args: ['hello'],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
  });

  it('should handle abort signal', async () => {
    const controller = new AbortController();

    setTimeout(() => controller.abort(), 100);

    await expect(
      spawnProcess({
        command: 'sleep',
        args: ['10'],
        signal: controller.signal,
      })
    ).rejects.toThrow();
  });

  it('should pipe stdin', async () => {
    const result = await spawnProcess({
      command: 'cat',
      stdinInput: 'test input',
    });

    expect(result.stdout).toBe('test input');
  });
});
```

Run the test:
```bash
bun test tests/unit/infra/spawn-bun.spec.ts
```

### Step 5.4: Replace Implementation Gradually

**Option A: Direct replacement**
```bash
# Backup old file
mv src/infra/process/spawn.ts src/infra/process/spawn-old.ts

# Rename new file
mv src/infra/process/spawn-bun.ts src/infra/process/spawn.ts
```

**Option B: Conditional import (safer)**

Update `src/infra/process/spawn.ts`:

```typescript
// Use Bun spawn when running in Bun, otherwise use cross-spawn
const isBun = typeof Bun !== 'undefined';

if (isBun) {
  export * from './spawn-bun.js';
} else {
  export * from './spawn-node.js';
}
```

### Step 5.5: Update execa Usage

Replace `execa` calls in `src/cli/commands/auth.command.ts`:

```typescript
// Before
import { execa } from 'execa';
await execa('opencode', ['auth', 'list'], {
  stdio: 'inherit',
  env: xdgEnv
});

// After
const proc = Bun.spawn(['opencode', 'auth', 'list'], {
  stdio: ['inherit', 'inherit', 'inherit'],
  env: xdgEnv,
});
await proc.exited;
```

### Step 5.6: Test All Engine Runners

```bash
# Test each engine runner
bun test tests/unit/infra/ccr-engine.spec.ts
bun test tests/unit/infra/engine-runner.spec.ts

# Integration test
bun run dev
# Try running a workflow
```

### Step 5.7: Remove Old Dependencies

```bash
bun remove cross-spawn execa
bun remove @types/cross-spawn
```

**Validation:**
```bash
# Test CLI spawning
bun dist/index.js --help

# Test engine execution (if you have engines installed)
bun run dev
# Run a test workflow

# Check process cleanup
bun test tests/unit/infra/
```

**Rollback:** Restore old spawn.ts and reinstall cross-spawn/execa

---

## Phase 6: Script Updates

**Goal:** Update Node.js scripts to use Bun.

### Step 6.1: Update validate.mjs

Replace `scripts/validate.mjs`:

```javascript
#!/usr/bin/env bun
import { $ } from 'bun';

const execCommand = async (cmd, description) => {
  console.log(`[validate] ${description}...`);
  await $`${cmd}`;
};

try {
  await execCommand('bun run lint', 'Running lint');
  await execCommand('bun run typecheck', 'Running typecheck');
  await execCommand('bun test', 'Running tests');
  console.log('[validate] All checks passed!');
} catch (error) {
  console.error('[validate] Validation failed');
  process.exit(1);
}
```

### Step 6.2: Update publish.mjs

Replace `scripts/publish.mjs`:

```javascript
#!/usr/bin/env bun
import { $ } from 'bun';

// Parse arguments
let dryRun = true;
let tag = 'latest';

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--dry-run':
      dryRun = true;
      break;
    case '--no-dry-run':
      dryRun = false;
      break;
    case '--tag':
      if (i + 1 >= args.length) {
        console.error('[publish] --tag requires a value');
        process.exit(1);
      }
      i++;
      tag = args[i];
      break;
    default:
      console.error(`[publish] Unknown option: ${args[i]}`);
      process.exit(1);
  }
}

console.log(`[publish] Dry run: ${dryRun}`);
console.log(`[publish] Using tag: ${tag}`);

const execCommand = async (cmd, description) => {
  console.log(`[publish] ${description}`);
  try {
    await $`${cmd}`;
  } catch (error) {
    console.error(`[publish] ${description} failed`);
    process.exit(1);
  }
};

try {
  // Verify clean git worktree
  console.log('[publish] Verifying clean git worktree');
  const gitStatus = await $`git status --porcelain`.text();
  if (gitStatus.trim()) {
    console.error('[publish] Worktree is not clean; commit or stash changes before publishing.');
    process.exit(1);
  }

  // Verify npm authentication
  console.log('[publish] Verifying npm authentication');
  await $`npm whoami`.quiet();

  // Run build, test, and lint
  await execCommand('bun run build', 'Running bun run build');
  await execCommand('bun test', 'Running bun test');
  await execCommand('bun run lint', 'Running bun run lint');

  // Publish
  const publishCmd = `npm publish --tag ${tag}`;

  if (dryRun) {
    console.log('[publish] Dry run enabled; publish command:');
    console.log(`[publish] ${publishCmd}`);
  } else {
    console.log('[publish] Publishing to npm');
    await $`npm publish --tag ${tag}`;
  }

  console.log('[publish] Release complete');
} catch (error) {
  console.error('[publish] Release failed');
  process.exit(1);
}
```

### Step 6.3: Make Scripts Executable

```bash
chmod +x scripts/validate.mjs
chmod +x scripts/publish.mjs
chmod +x scripts/build.mjs
```

### Step 6.4: Test Scripts

```bash
# Test validation script
bun scripts/validate.mjs

# Test build script
rm -rf dist
bun scripts/build.mjs

# Test publish script (dry run)
bun scripts/publish.mjs --dry-run --tag latest
```

**Validation:**
```bash
bun run validate  # Should run all checks
bun run release  # Should show dry-run output
```

**Rollback:** Restore old script files from git

---

## Phase 7: Testing & Validation

**Goal:** Comprehensive testing of the migrated codebase.

### Step 7.1: Run All Tests

```bash
# Unit tests
bun test tests/unit

# Integration tests
bun test tests/integration

# E2E tests
bun test tests/e2e

# UI tests
bun test tests/ui

# All tests with coverage
bun test --coverage
```

### Step 7.2: Test Build Pipeline

```bash
# Clean build
rm -rf dist
bun run build

# Verify output
ls -lah dist/
file dist/index.js
head -n 5 dist/index.js

# Test built binary
./dist/index.js --version
./dist/index.js --help
```

### Step 7.3: Test Development Workflow

```bash
# Start dev mode
bun run dev

# Test hot reload (if applicable)
# Make a change to a source file and check if it reloads
```

### Step 7.4: Test Engine Runners

If you have AI engines installed:

```bash
# Test CCR
bun run dev
# Run a workflow with CCR engine

# Test Claude
# Run a workflow with Claude engine

# Test other engines
# ...
```

### Step 7.5: Test Package Scripts

```bash
bun run lint
bun run format
bun run typecheck
bun run validate
```

### Step 7.6: Test Global Install (Optional)

```bash
# Link locally
bun link

# Test global command
codemachine --version
codemachine --help

# Unlink
bun unlink
```

### Step 7.7: Performance Benchmarking

```bash
# Benchmark install time
rm -rf node_modules bun.lockb
time bun install

# Benchmark build time
rm -rf dist
time bun run build

# Benchmark test time
time bun test

# Compare with old results (if saved)
diff test-results-before.txt <(bun test 2>&1)
```

### Step 7.8: Cross-Platform Testing

If possible, test on:
- Linux ✓ (current platform)
- macOS (if available)
- Windows/WSL (if available)

**Validation Checklist:**
- [ ] All tests pass
- [ ] Build produces correct output
- [ ] Binary is executable
- [ ] Dev mode works
- [ ] Linting works
- [ ] Type checking works
- [ ] Scripts execute correctly
- [ ] Performance meets expectations

---

## Phase 8: UI Migration & Documentation

**Goal:** Attempt UI migration to Bun, update documentation, and clean up migration artifacts.

⚠️ **Note:** This phase includes attempting the UI migration. If it fails, we'll document the issues and keep tsx for UI development. See `docs/02-bun-migration-ui-risk-analysis.md` for known risks.

### Step 8.0: Attempt UI Migration to Bun (Optional)

**Prerequisites:** Phases 1-7 completed successfully.

**Step 8.0.1: Debug Module Resolution**

Follow the debugging steps from `docs/02-bun-migration-ui-risk-analysis.md`:

```bash
# Enable debug mode
BUN_DEBUG=1 bun run dev:bun 2>&1 | tee bun-ui-debug.log

# Analyze error
cat bun-ui-debug.log | grep -A10 "Cannot find module"

# Try to identify the problematic package
bun -e "import { render } from 'ink'" 2>&1
bun -e "import React from 'react'" 2>&1
bun -e "import yoga from 'yoga-layout-prebuilt'" 2>&1
```

**Step 8.0.2: Test Native Dependencies**

```bash
# Test yoga layout
bun -e "
const yoga = require('yoga-layout-prebuilt');
const node = yoga.Node.create();
node.setWidth(100);
console.log('Yoga works! Width:', node.getComputedWidth());
"

# If it fails, try rebuilding
bun rebuild yoga-layout-prebuilt
```

**Step 8.0.3: Decision Point**

**If module resolution AND yoga both work:**

```json
// Update package.json
{
  "scripts": {
    "dev": "DEBUG=true bun src/runtime/cli-setup.ts",
    "debug": "REACT_DEVTOOLS=1 DEBUG=\"ink:*\" bun src/runtime/cli-setup.ts"
  }
}
```

Then:
```bash
# Remove tsx
bun remove tsx

# Test thoroughly
bun run dev
# Verify all UI features work
```

**If either fails (expected with Bun v1.3.2):**

Keep the dual runtime approach:

```json
{
  "scripts": {
    "dev": "tsx src/runtime/cli-setup.ts",
    "dev:bun": "bun src/runtime/cli-setup.ts (experimental - may not work)"
  }
}
```

Document the issues in migration notes and revisit in 3-6 months when Bun improves.

---

### Step 8.1: Update README.md

Update installation instructions:

```markdown
## Installation

### Global Installation

```bash
npm install -g codemachine
# or
bun install -g codemachine
```

### Development Setup

```bash
# Clone repository
git clone https://github.com/yourusername/codemachine.git
cd codemachine

# Install dependencies with Bun
bun install

# Run in development mode
bun run dev

# Build for production
bun run build

# Run tests
bun test
```
```

### Step 8.2: Update Contributing Guide

Create/update `CONTRIBUTING.md`:

```markdown
## Development Requirements

- **Bun** >= 1.0.0
- **Git**

## Setup

```bash
bun install
```

## Available Scripts

- `bun run dev` - Start development mode
- `bun run build` - Build for production
- `bun test` - Run tests
- `bun test --watch` - Run tests in watch mode
- `bun run lint` - Lint code
- `bun run format` - Format code
- `bun run typecheck` - Type check
- `bun run validate` - Run all checks (lint + typecheck + test)
```
```

### Step 8.3: Update package.json Metadata

```json
{
  "engines": {
    "bun": ">=1.0.0"
  },
  "scripts": {
    "prepare": "husky install",
    "postinstall": "bun run build"
  }
}
```

### Step 8.4: Document Migration Results

Create `docs/03-bun-migration-results.md` documenting:
- What changed in each phase
- Actual performance improvements observed
- Any issues encountered and how they were resolved
- Final status of UI migration (successful or deferred)
- Rollback procedures tested

**Note:** `docs/02-bun-migration-ui-risk-analysis.md` already documents known UI risks.

### Step 8.5: Clean Up Old Files

```bash
# Remove backup files
rm -f package-lock.json.backup
rm -f pnpm-lock.yaml.backup
rm -f test-results-before.txt
rm -f dist-before.txt

# Remove old spawn implementation (if using direct replacement)
rm -f src/infra/process/spawn-old.ts
rm -f src/infra/process/spawn-node.ts

# Remove old lockfiles
rm -f package-lock.json pnpm-lock.yaml
```

### Step 8.6: Update CI/CD (if applicable)

If you have GitHub Actions or other CI:

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Run tests
        run: bun test

      - name: Run lint
        run: bun run lint

      - name: Type check
        run: bun run typecheck
```

**Validation:**
- [ ] README updated
- [ ] Contributing guide updated
- [ ] package.json metadata updated
- [ ] Migration notes documented
- [ ] Old files cleaned up
- [ ] CI/CD updated (if applicable)

---

## Rollback Plan

### Quick Rollback (if migration fails early)

```bash
# Switch back to backup branch
git checkout backup/pre-bun-migration

# Reinstall with pnpm
rm -rf node_modules bun.lockb
pnpm install

# Verify everything works
pnpm test
pnpm run build
```

### Partial Rollback (by phase)

Each phase has specific rollback instructions. In general:

1. **Restore old dependency:**
   ```bash
   bun add -d <package-name>
   ```

2. **Restore old script:**
   ```bash
   git checkout main -- scripts/filename.mjs
   ```

3. **Restore old implementation:**
   ```bash
   git checkout main -- src/path/to/file.ts
   ```

4. **Restore old package.json:**
   ```bash
   git checkout main -- package.json
   ```

### Full Rollback

```bash
# Abandon migration branch
git checkout main
git branch -D feature/bun-migration

# Restore from backup
git merge backup/pre-bun-migration

# Reinstall
rm -rf node_modules bun.lockb
pnpm install
```

---

## Expected Outcomes

### Performance Improvements

Based on Bun benchmarks and typical Node.js projects:

| Metric | Before (Node/pnpm) | After (Bun) | Improvement |
|--------|-------------------|-------------|-------------|
| Install time | ~30-60s | ~3-5s | **10-20x faster** |
| Build time | ~5-10s | ~2-3s | **2-5x faster** |
| Test execution | ~10-20s | ~3-5s | **3-4x faster** |
| Dev startup | ~3-5s | ~0.5-1s | **5-10x faster** |
| Runtime perf | Baseline | +30-50% faster | **1.3-1.5x faster** |

### Simplified Toolchain

**Before:**
- Package manager: pnpm
- Bundler: tsup (wraps esbuild)
- Runtime (dev): tsx
- Runtime (prod): node
- Test runner: vitest
- Process spawning: cross-spawn + execa
- Total dev dependencies: ~50+

**After:**
- All-in-one: Bun
- Total dev dependencies: ~35 (kept: ESLint, Prettier, TypeScript)

### Developer Experience

- ✅ Single tool for all tasks
- ✅ Faster feedback loops
- ✅ Native TypeScript support (no transpilation needed)
- ✅ Better error messages
- ✅ Built-in test runner and coverage
- ✅ Simplified configuration

---

## References

### Official Documentation
- [Bun Documentation](https://bun.sh/docs)
- [Bun Runtime API](https://bun.sh/docs/api)
- [Bun Test Runner](https://bun.sh/docs/cli/test)
- [Bun Bundler](https://bun.sh/docs/bundler)
- [Migrating from Node.js](https://bun.sh/docs/runtime/nodejs-apis)

### Key Files Modified
- `package.json` - Scripts and dependencies
- `src/infra/process/spawn.ts` - Process spawning implementation
- `scripts/build.mjs` - Build script
- `scripts/validate.mjs` - Validation script
- `scripts/publish.mjs` - Publishing script
- `bunfig.toml` - Bun configuration (new)

### Compatibility Notes
- Bun implements Node.js APIs for compatibility
- Most Node.js packages work without changes
- Some native modules may need rebuilding
- Bun's test runner is compatible with Jest/Vitest APIs

### Support & Troubleshooting
- [Bun Discord](https://bun.sh/discord)
- [Bun GitHub Issues](https://github.com/oven-sh/bun/issues)
- [Bun Examples](https://github.com/oven-sh/bun/tree/main/examples)

---

## Next Steps

1. ✅ Review this migration plan
2. ✅ Review `docs/02-bun-migration-ui-risk-analysis.md` (UI risks)
3. ⏳ Create backup branch
4. ⏳ Start Phase 1: Package Manager Migration
5. ⏳ Progress through phases sequentially (1-7)
6. ⏳ Document any issues encountered
7. ⏳ Attempt Phase 8 (UI migration) - may defer if issues persist
8. ⏳ Celebrate successful migration! 🎉

---

**Document Version:** 1.1
**Last Updated:** 2025-11-11
**Migration Status:** Not Started
**UI Migration Strategy:** Conservative (dual runtime: tsx for dev, Bun for production)
