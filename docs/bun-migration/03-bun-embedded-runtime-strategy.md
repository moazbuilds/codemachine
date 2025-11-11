# Bun Embedded Runtime Strategy for CodeMachine

**Version 1.0** | **Last Updated:** 2025-11-11 | **Status:** Design Document

> 📋 **Related Documents:**
> - `01-bun-migration-plan.md` - Core migration plan and phases
> - `02-bun-migration-ui-risk-analysis.md` - UI migration risks and testing results
> - `04-bun-migration-results.md` - Post-migration results (to be created)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Benefits & Trade-offs](#benefits--trade-offs)
4. [Build Process](#build-process)
5. [Distribution Strategy](#distribution-strategy)
6. [Runtime Detection](#runtime-detection)
7. [Performance Optimizations](#performance-optimizations)
8. [Implementation Guide](#implementation-guide)
9. [Version Management](#version-management)
10. [Platform Support](#platform-support)
11. [Migration from Node.js Binary](#migration-from-nodejs-binary)

---

## Overview

### What is Embedded Runtime?

The embedded runtime strategy packages a complete Bun executable (v1.3.0+) within each platform-specific binary distribution of CodeMachine. This approach eliminates the need for users to install Bun separately and ensures consistent runtime behavior across all platforms.

### Key Concept

Instead of requiring:
```bash
# Traditional approach
npm install -g bun
npm install -g codemachine
codemachine run workflow.js
```

Users get:
```bash
# Embedded approach
npm install -g codemachine
codemachine run workflow.js  # Uses embedded Bun automatically
```

### Architecture Overview

```
codemachine (npm package)
├── codemachine-linux-x64/        # Platform-specific package
│   ├── bin/
│   │   └── codemachine           # Embedded Bun executable (~90-100MB)
│   └── package.json
├── codemachine-darwin-arm64/     # Platform-specific package
│   ├── bin/
│   │   └── codemachine           # Embedded Bun executable (~90-100MB)
│   └── package.json
├── codemachine-win32-x64/        # Platform-specific package
│   ├── bin/
│   │   └── codemachine.exe       # Embedded Bun executable (~90-100MB)
│   └── package.json
└── codemachine/                   # Main package (shell wrapper)
    ├── bin/
    │   └── codemachine.js         # Shell wrapper script
    ├── package.json
    └── postinstall.js             # Creates symlinks
```

---

## Architecture

### Component Layers

#### 1. Main Package (`codemachine`)

**Role:** Shell wrapper and binary resolver

```json
{
  "name": "codemachine",
  "version": "0.5.0",
  "bin": {
    "codemachine": "./bin/codemachine.js"
  },
  "optionalDependencies": {
    "codemachine-linux-x64": "0.5.0",
    "codemachine-linux-arm64": "0.5.0",
    "codemachine-darwin-x64": "0.5.0",
    "codemachine-darwin-arm64": "0.5.0",
    "codemachine-win32-x64": "0.5.0"
  },
  "scripts": {
    "postinstall": "node postinstall.js"
  }
}
```

**File: `bin/codemachine.js`** (Shell Wrapper)

```javascript
#!/usr/bin/env node

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Detect platform
const PLATFORM_ARCH = `${process.platform}-${process.arch}`;
const PACKAGE_NAME = `codemachine-${PLATFORM_ARCH}`;

// Search for platform-specific binary in node_modules
const searchPaths = [
  join(__dirname, '..', 'node_modules', PACKAGE_NAME, 'bin', 'codemachine'),
  join(__dirname, '..', '..', PACKAGE_NAME, 'bin', 'codemachine'),
  join(__dirname, 'codemachine'), // Symlink created by postinstall
];

// Windows needs .exe extension
const binaryName = process.platform === 'win32' ? 'codemachine.exe' : 'codemachine';
const binaryPath = searchPaths
  .map(p => p.replace(/codemachine$/, binaryName))
  .find(p => existsSync(p));

if (!binaryPath) {
  console.error(`Platform-specific binary not found for ${PLATFORM_ARCH}`);
  console.error('Please run: npm install');
  process.exit(1);
}

// Spawn embedded Bun binary with all arguments
const child = spawn(binaryPath, process.argv.slice(2), {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
```

**File: `postinstall.js`** (Symlink Creator)

```javascript
import { symlink, unlink, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Only create symlinks on Unix systems (for faster startup)
if (process.platform === 'win32') {
  process.exit(0);
}

const PLATFORM_ARCH = `${process.platform}-${process.arch}`;
const PACKAGE_NAME = `codemachine-${PLATFORM_ARCH}`;

const binaryPath = join(__dirname, 'node_modules', PACKAGE_NAME, 'bin', 'codemachine');
const symlinkPath = join(__dirname, 'bin', 'codemachine');

if (!existsSync(binaryPath)) {
  console.warn(`Platform binary not found: ${binaryPath}`);
  process.exit(0);
}

// Remove existing symlink
if (existsSync(symlinkPath)) {
  try {
    unlink(symlinkPath, () => {});
  } catch (err) {
    // Ignore errors
  }
}

// Create new symlink
symlink(binaryPath, symlinkPath, (err) => {
  if (err) {
    console.warn('Failed to create symlink:', err.message);
  }
});
```

#### 2. Platform-Specific Packages

Each platform package contains the compiled Bun binary with embedded CodeMachine code.

**Example: `codemachine-linux-x64/package.json`**

```json
{
  "name": "codemachine-linux-x64",
  "version": "0.5.0",
  "os": ["linux"],
  "cpu": ["x64"],
  "bin": {
    "codemachine": "./bin/codemachine"
  }
}
```

#### 3. Embedded Bun Runtime

The platform binaries are created using `Bun.build()` with `compile: true`:

```typescript
// build-binary.ts
import { build } from 'bun';

const result = await build({
  entrypoints: ['./src/runtime/index.ts'],
  compile: {
    // Target platform
    target: 'bun-linux-x64', // or bun-darwin-arm64, bun-win32-x64, etc.

    // Embed Bun runtime (~90MB)
    bun: true,

    // Minify for smaller size
    minify: true,

    // Source maps for debugging
    sourcemap: 'external',
  },

  // External dependencies (will be bundled)
  external: [],

  // Output path
  outdir: './dist/binaries/linux-x64',
});

console.log('Binary created:', result.outputs[0].path);
```

---

## Benefits & Trade-offs

### ✅ Benefits

#### 1. **Zero Installation Overhead**
- No need to install Bun separately
- Works immediately after `npm install -g codemachine`
- No version conflicts with user-installed Bun

#### 2. **Version Control**
- Lock to specific Bun version (currently 1.3.0)
- Predictable behavior across all installations
- Easy version upgrades (just rebuild binaries)

#### 3. **Performance**
- **Instant startup:** No compilation or extraction on first run
- **No build scripts:** Pre-compiled binaries install in milliseconds
- **Faster than Node.js:** Bun's runtime is 2-4x faster for I/O operations

#### 4. **Simplified Distribution**
- Single `npm install` command
- Works on CI/CD without setup
- Compatible with all package managers (npm, yarn, pnpm, bun)

#### 5. **Embedded Bun APIs**
- Access full Bun API within the binary
- `Bun.spawn()`, `Bun.file()`, `Bun.write()` all available
- Can run Bun commands internally (plugin installation, etc.)

### ⚠️ Trade-offs

#### 1. **Disk Space**
- Each platform binary: ~90-100MB
- Total for all 5 platforms: ~450-500MB
- Users only download their platform (90-100MB)

#### 2. **Build Complexity**
- Requires building 5 separate binaries
- CI/CD must support cross-platform builds
- Longer build times (1-2 minutes per platform)

#### 3. **Package Registry Size**
- Larger npm package storage
- Slower initial `npm install` (larger download)
- Registry limits (npm allows up to 500MB per package)

#### 4. **Update Coordination**
- All platform binaries must be version-synced
- Failed binary build blocks entire release
- Requires testing on all 5 platforms

---

## Build Process

### Build Script Architecture

**File: `scripts/build-binaries.ts`**

```typescript
import { $ } from 'bun';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Platform targets
const PLATFORMS = [
  { os: 'linux', arch: 'x64', target: 'bun-linux-x64' },
  { os: 'linux', arch: 'arm64', target: 'bun-linux-arm64' },
  { os: 'darwin', arch: 'x64', target: 'bun-darwin-x64' },
  { os: 'darwin', arch: 'arm64', target: 'bun-darwin-arm64' },
  { os: 'win32', arch: 'x64', target: 'bun-windows-x64' },
] as const;

interface BuildOptions {
  platform: typeof PLATFORMS[number];
  minify: boolean;
  sourcemap: boolean;
}

async function buildPlatformBinary({ platform, minify, sourcemap }: BuildOptions) {
  const { os, arch, target } = platform;
  const packageName = `codemachine-${os}-${arch}`;
  const outputDir = join(process.cwd(), 'dist', 'binaries', packageName);

  console.log(`Building ${packageName}...`);

  // Create output directory
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Build binary using Bun.build with compile: true
  const result = await Bun.build({
    entrypoints: ['./src/runtime/index.ts'],
    compile: {
      target,
      bun: true,
      minify,
      sourcemap: sourcemap ? 'external' : undefined,
    },
    outdir: join(outputDir, 'bin'),
    naming: os === 'win32' ? 'codemachine.exe' : 'codemachine',
  });

  if (!result.success) {
    console.error(`Failed to build ${packageName}:`, result.logs);
    throw new Error(`Build failed for ${packageName}`);
  }

  // Create package.json for platform package
  await Bun.write(
    join(outputDir, 'package.json'),
    JSON.stringify({
      name: packageName,
      version: process.env.VERSION || '0.5.0',
      os: [os],
      cpu: [arch],
      bin: {
        codemachine: `./bin/${os === 'win32' ? 'codemachine.exe' : 'codemachine'}`,
      },
    }, null, 2)
  );

  console.log(`✓ Built ${packageName} (${result.outputs[0].size} bytes)`);
}

// Build all platforms in parallel
async function buildAll() {
  const startTime = Date.now();

  await Promise.all(
    PLATFORMS.map(platform =>
      buildPlatformBinary({
        platform,
        minify: true,
        sourcemap: process.env.NODE_ENV === 'development',
      })
    )
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✓ All binaries built in ${duration}s`);
}

// Run build
await buildAll();
```

### Build Commands

Add to `package.json`:

```json
{
  "scripts": {
    "build": "bun run scripts/build-binaries.ts",
    "build:dev": "NODE_ENV=development bun run scripts/build-binaries.ts",
    "build:single": "bun run scripts/build-binaries.ts --platform linux-x64"
  }
}
```

### CI/CD Integration

**GitHub Actions Example:**

```yaml
name: Build Binaries

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            platform: linux-x64
          - os: ubuntu-latest
            platform: linux-arm64
          - os: macos-latest
            platform: darwin-x64
          - os: macos-latest
            platform: darwin-arm64
          - os: windows-latest
            platform: win32-x64

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: '1.3.0'

      - name: Install dependencies
        run: bun install

      - name: Build binary
        run: bun run build:single --platform ${{ matrix.platform }}

      - name: Upload binary artifact
        uses: actions/upload-artifact@v4
        with:
          name: codemachine-${{ matrix.platform }}
          path: dist/binaries/codemachine-${{ matrix.platform }}

  publish:
    needs: build
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: dist/binaries

      - name: Publish to npm
        run: |
          # Publish each platform package
          for dir in dist/binaries/codemachine-*; do
            cd "$dir"
            npm publish --access public
            cd -
          done

          # Publish main package
          npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Distribution Strategy

### Package Structure on npm

When published, users will see:

```bash
# Main package (shell wrapper)
npm install codemachine

# Platform-specific packages (auto-installed as optionalDependencies)
codemachine-linux-x64
codemachine-linux-arm64
codemachine-darwin-x64
codemachine-darwin-arm64
codemachine-win32-x64
```

### Installation Flow

1. User runs: `npm install -g codemachine`
2. npm installs main package
3. npm detects platform and installs matching optionalDependency
4. Postinstall script creates symlink (Unix only)
5. User runs: `codemachine run workflow.js`
6. Shell wrapper finds platform binary and executes it

### Platform Detection

```javascript
// Automatic platform detection
const platform = process.platform; // 'linux', 'darwin', 'win32'
const arch = process.arch;         // 'x64', 'arm64'

// Supported combinations
const SUPPORTED_PLATFORMS = [
  'linux-x64',
  'linux-arm64',
  'darwin-x64',
  'darwin-arm64',
  'win32-x64',
];

const currentPlatform = `${platform}-${arch}`;

if (!SUPPORTED_PLATFORMS.includes(currentPlatform)) {
  throw new Error(`Unsupported platform: ${currentPlatform}`);
}
```

---

## Runtime Detection

### Development vs Production

The compiled binary needs to detect whether it's running in development or production mode.

**File: `src/runtime/detect-mode.ts`**

```typescript
/**
 * Detect if running in development or production mode
 */
export function isProductionBinary(): boolean {
  // In compiled Bun binary, Bun.main will point to the embedded entry
  // In development, it points to the actual source file

  // Method 1: Check if running as compiled binary
  if (typeof Bun !== 'undefined' && Bun.main.endsWith('.exe')) {
    return true;
  }

  // Method 2: Check environment variable
  if (process.env.NODE_ENV === 'production') {
    return true;
  }

  // Method 3: Check if running via `bun run`
  if (process.argv[0].includes('bun') && process.argv[1].endsWith('.ts')) {
    return false;
  }

  return false;
}

/**
 * Get embedded Bun executable path
 */
export function getEmbeddedBunPath(): string {
  if (!isProductionBinary()) {
    throw new Error('Not running as production binary');
  }

  // The executable path is the current binary
  return process.execPath;
}

/**
 * Use embedded Bun for operations
 */
export async function runWithEmbeddedBun(
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> }
) {
  const bunPath = isProductionBinary()
    ? getEmbeddedBunPath()
    : 'bun'; // Use system Bun in development

  const proc = Bun.spawn([bunPath, ...args], {
    cwd: options?.cwd,
    env: { ...process.env, ...options?.env },
    stdout: 'inherit',
    stderr: 'inherit',
  });

  await proc.exited;
  return proc.exitCode;
}
```

### Example Usage

```typescript
import { runWithEmbeddedBun, isProductionBinary } from './detect-mode.js';

// Install a plugin using embedded Bun
async function installPlugin(pluginName: string) {
  console.log(`Installing plugin: ${pluginName}`);

  // This will use the embedded Bun in production
  // or system Bun in development
  const exitCode = await runWithEmbeddedBun(
    ['install', pluginName],
    { cwd: process.cwd() }
  );

  if (exitCode !== 0) {
    throw new Error(`Failed to install plugin: ${pluginName}`);
  }
}

// Run a script using embedded Bun
async function runScript(scriptPath: string, args: string[]) {
  const exitCode = await runWithEmbeddedBun(
    [scriptPath, ...args],
    { cwd: process.cwd() }
  );

  return exitCode;
}
```

---

## Performance Optimizations

### 1. Lazy Extraction of Embedded Binaries

**Problem:** Some approaches extract the entire binary to temp directory on first run.

**Solution:** Bun's `compile: true` creates a **single standalone executable** that doesn't require extraction.

**Implementation:**

```typescript
// ❌ DON'T: Extract to temp (slow)
const tempDir = join(os.tmpdir(), 'codemachine');
await extractBinary(bundledBinary, tempDir);

// ✅ DO: Execute directly (instant)
const binary = process.execPath; // Points directly to executable
```

### 2. Single Standalone Executable

Bun embeds all dependencies directly in the binary:

```typescript
await Bun.build({
  entrypoints: ['./src/runtime/index.ts'],
  compile: {
    target: 'bun-linux-x64',
    bun: true,

    // Everything is bundled, no external dependencies
    external: [],
  },
});
```

**Result:**
- No `node_modules` required at runtime
- Single file distribution
- Faster startup (no module resolution)

### 3. Optimized Binary Size

Minimize binary size without sacrificing functionality:

```typescript
await Bun.build({
  compile: {
    // Enable minification
    minify: {
      identifiers: true,
      syntax: true,
      whitespace: true,
    },

    // Tree-shake unused code
    treeShaking: true,

    // Remove debug symbols in production
    strip: process.env.NODE_ENV === 'production',
  },
});
```

**Typical sizes:**
- Unoptimized: ~120MB
- Optimized: ~90-95MB
- With compression: ~40-50MB (if using upx)

### 4. Platform-Specific Optimization

Each platform binary can be optimized differently:

```typescript
const PLATFORM_OPTIMIZATIONS = {
  'bun-linux-x64': {
    minify: true,
    strip: true,
    // Use system allocator on Linux
    malloc: 'system',
  },
  'bun-darwin-arm64': {
    minify: true,
    // Use Apple's allocator on macOS
    malloc: 'system',
  },
  'bun-windows-x64': {
    minify: true,
    // Windows-specific optimizations
    windowsHideConsole: false,
  },
};
```

### 5. No Installation Overhead

Unlike traditional npm packages:

```bash
# Traditional approach (slow)
npm install -g codemachine
# - Downloads package (~100KB)
# - Runs postinstall script
# - Compiles native modules (~10-30s)
# - Runs esbuild/tsup (~5-10s)
# Total: 15-40 seconds

# Embedded binary approach (fast)
npm install -g codemachine
# - Downloads platform binary (~90MB)
# - Creates symlink (~10ms)
# Total: 2-5 seconds (network bound)
```

### 6. Startup Performance

```typescript
// Measure startup time
const start = performance.now();

// In embedded binary: ~50-100ms
// In Node.js + bundled code: ~200-500ms
// In tsx (TypeScript): ~1000-2000ms

const startup = performance.now() - start;
console.log(`Startup time: ${startup.toFixed(2)}ms`);
```

---

## Implementation Guide

### Step 1: Restructure Entry Point

**Current structure:**

```
src/
└── runtime/
    ├── index.ts          # Entry point
    └── cli-setup.ts      # CLI initialization
```

**New structure:**

```
src/
└── runtime/
    ├── index.ts          # Entry point (works for both bun and compiled)
    ├── cli-setup.ts      # CLI initialization
    ├── detect-mode.ts    # Runtime detection
    └── embedded-bun.ts   # Embedded Bun utilities
```

### Step 2: Update Entry Point

**File: `src/runtime/index.ts`**

```typescript
#!/usr/bin/env bun

import { isProductionBinary } from './detect-mode.js';
import { setupCLI } from './cli-setup.js';

// Detect mode
if (isProductionBinary()) {
  console.log('Running in production mode (embedded binary)');
} else {
  console.log('Running in development mode');
}

// Initialize CLI
await setupCLI();
```

### Step 3: Replace Node.js APIs with Bun APIs

**Before (Node.js):**

```typescript
import { readFile, writeFile } from 'fs/promises';
import { spawn } from 'child_process';

// File operations
const content = await readFile('/path/to/file', 'utf-8');
await writeFile('/path/to/file', content);

// Process spawning
const child = spawn('command', ['arg1', 'arg2']);
```

**After (Bun):**

```typescript
// File operations (2-3x faster)
const file = Bun.file('/path/to/file');
const content = await file.text();
await Bun.write('/path/to/file', content);

// Process spawning (simpler API)
const proc = Bun.spawn(['command', 'arg1', 'arg2'], {
  stdout: 'inherit',
  stderr: 'inherit',
});
await proc.exited;
```

### Step 4: Handle Platform-Specific Native Dependencies

**Problem:** `yoga-layout-prebuilt` is a native C++ module.

**Solution 1:** Bundle pre-built binaries for each platform

```typescript
// Detect platform and load correct binary
const yogaBinaryPath = join(__dirname, 'native', `yoga-${process.platform}-${process.arch}.node`);

const yoga = await import(yogaBinaryPath);
```

**Solution 2:** Use Bun's native module support

```typescript
// Bun can load native modules directly
import yoga from 'yoga-layout-prebuilt';

// Works in both development and compiled binary
```

**Solution 3:** Replace with pure JavaScript alternative

```typescript
// Use a pure JS layout engine
import { computeLayout } from 'css-layout';
```

### Step 5: Create Build Scripts

**File: `scripts/build-binaries.ts`** (see [Build Process](#build-process) section)

### Step 6: Update Package Structure

**Create platform package templates:**

```
platform-packages/
├── linux-x64/
│   └── package.json
├── linux-arm64/
│   └── package.json
├── darwin-x64/
│   └── package.json
├── darwin-arm64/
│   └── package.json
└── win32-x64/
    └── package.json
```

**Each `package.json`:**

```json
{
  "name": "codemachine-${PLATFORM}",
  "version": "0.5.0",
  "os": ["${OS}"],
  "cpu": ["${ARCH}"],
  "bin": {
    "codemachine": "./bin/codemachine"
  }
}
```

### Step 7: Update Main Package

**File: `package.json`**

```json
{
  "name": "codemachine",
  "version": "0.5.0",
  "bin": {
    "codemachine": "./bin/codemachine.js"
  },
  "optionalDependencies": {
    "codemachine-linux-x64": "0.5.0",
    "codemachine-linux-arm64": "0.5.0",
    "codemachine-darwin-x64": "0.5.0",
    "codemachine-darwin-arm64": "0.5.0",
    "codemachine-win32-x64": "0.5.0"
  },
  "scripts": {
    "postinstall": "node postinstall.js",
    "build": "bun run scripts/build-binaries.ts"
  }
}
```

### Step 8: Implement Postinstall Script

**File: `postinstall.js`** (see [Architecture](#architecture) section)

### Step 9: Implement Shell Wrapper

**File: `bin/codemachine.js`** (see [Architecture](#architecture) section)

### Step 10: Test Locally

```bash
# Build all binaries
bun run build

# Test local installation
npm link

# Test binary
codemachine --version
codemachine run test-workflow.js
```

### Step 11: Embed Additional Binaries

If you need to embed other executables (like OpenCode's Go TUI):

```typescript
// Embed files at build time
await Bun.build({
  entrypoints: ['./src/runtime/index.ts'],
  compile: {
    target: 'bun-linux-x64',
    bun: true,

    // Embed additional files
    embedFiles: [
      './binaries/opencode-tui-linux',
      './binaries/opencode-tui-darwin',
      './binaries/opencode-tui-windows.exe',
    ],
  },
});

// Access embedded files at runtime
import { embeddedFiles } from 'bun';

const goTuiBinary = embeddedFiles['opencode-tui-linux'];

// Extract to temp and execute
const tempPath = join(os.tmpdir(), 'opencode-tui');
await Bun.write(tempPath, goTuiBinary);
await chmod(tempPath, 0o755);

const proc = Bun.spawn([tempPath, ...args]);
await proc.exited;
```

---

## Version Management

### Bun Version Control

Lock to a specific Bun version for consistency:

```json
{
  "engines": {
    "bun": ">=1.3.0 <2.0.0"
  }
}
```

### Build Version Matrix

Track which Bun version was used for each binary:

```typescript
// Embed build metadata
const buildInfo = {
  bunVersion: Bun.version,
  buildDate: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
  nodeVersion: process.versions.node,
};

// Write to binary
await Bun.write(
  join(outputDir, 'build-info.json'),
  JSON.stringify(buildInfo, null, 2)
);
```

### Version Checking at Runtime

```typescript
// Check if binary needs update
async function checkBinaryVersion() {
  const currentVersion = '0.5.0';
  const buildInfo = await Bun.file('/path/to/build-info.json').json();

  if (buildInfo.bunVersion !== Bun.version) {
    console.warn('Binary was built with different Bun version');
    console.warn(`  Built with: ${buildInfo.bunVersion}`);
    console.warn(`  Running on: ${Bun.version}`);
  }
}
```

---

## Platform Support

### Supported Platforms

| Platform | Architecture | Binary Size | Status |
|----------|-------------|-------------|---------|
| **Linux** | x64 | ~95MB | ✅ Supported |
| **Linux** | arm64 | ~92MB | ✅ Supported |
| **macOS** | x64 (Intel) | ~98MB | ✅ Supported |
| **macOS** | arm64 (Apple Silicon) | ~90MB | ✅ Supported |
| **Windows** | x64 | ~100MB | ✅ Supported |

### Platform-Specific Considerations

#### Linux

- **glibc version:** Requires glibc 2.27+ (Ubuntu 18.04+)
- **Dependencies:** None (statically linked)
- **Permissions:** Executable bit set via postinstall

#### macOS

- **Minimum version:** macOS 11.0 (Big Sur)
- **Code signing:** Optional (can be added for distribution)
- **Gatekeeper:** Users may need to allow unsigned binary

#### Windows

- **Minimum version:** Windows 10 (1809+)
- **Antivirus:** May flag unsigned executable (false positive)
- **Console:** No console window by default (unless debugging)

### Unsupported Platforms

For unsupported platforms, fallback to Node.js runtime:

```javascript
// In shell wrapper
if (!SUPPORTED_PLATFORMS.includes(currentPlatform)) {
  console.warn(`Platform ${currentPlatform} not supported with embedded binary`);
  console.warn('Falling back to Node.js runtime');

  // Execute with Node.js
  const { spawn } = require('child_process');
  const child = spawn('node', ['./dist/index.js', ...process.argv.slice(2)], {
    stdio: 'inherit',
  });

  child.on('exit', (code) => process.exit(code));
}
```

---

## Migration from Node.js Binary

### Current State (Node.js)

```json
{
  "bin": {
    "codemachine": "./dist/index.js"
  }
}
```

```javascript
#!/usr/bin/env node
// dist/index.js
import { setupCLI } from './cli-setup.js';
await setupCLI();
```

### Migration Steps

1. **Build Bun binaries** (see [Build Process](#build-process))
2. **Publish platform packages** to npm
3. **Update main package** to use shell wrapper
4. **Test installation** on all platforms
5. **Publish new version** to npm
6. **Monitor for issues** (fallback to Node.js if needed)

### Backward Compatibility

Keep Node.js binary as fallback:

```json
{
  "bin": {
    "codemachine": "./bin/codemachine.js",
    "codemachine-node": "./dist/index.js"
  }
}
```

Users can explicitly use Node.js version:

```bash
codemachine-node run workflow.js
```

---

## Summary

The embedded Bun runtime strategy provides:

✅ **Zero installation overhead** - Works immediately after `npm install`
✅ **Version control** - Lock to specific Bun version (1.3.0)
✅ **Performance** - 2-4x faster I/O, instant startup
✅ **Simplified distribution** - Single binary per platform
✅ **Embedded Bun APIs** - Full access to Bun features

Trade-offs:

⚠️ **Disk space** - ~90-100MB per platform binary
⚠️ **Build complexity** - Requires building 5 separate binaries
⚠️ **CI/CD setup** - Cross-platform build matrix needed

**Next Steps:**

1. Implement build script (`scripts/build-binaries.ts`)
2. Create platform package templates
3. Implement shell wrapper and postinstall script
4. Set up CI/CD for cross-platform builds
5. Test on all 5 platforms
6. Publish to npm

**Related Documents:**

- `01-bun-migration-plan.md` - Follow Phase 2 (Build Tooling) and Phase 5 (Process Spawning)
- `02-bun-migration-ui-risk-analysis.md` - Ensure UI compatibility before building binaries
- `04-bun-migration-results.md` - Document performance improvements after migration
