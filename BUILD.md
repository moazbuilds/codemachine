# Building CodeMachine

This guide explains how to build, test, and publish CodeMachine from source.

## Quick Reference

| Command | When to Use | What It Does | Output |
|---------|-------------|--------------|--------|
| `bun run dev` | **Development** | Run from source with hot reload | No build artifacts |
| `bun run build:binaries` | **Production build** | Compile platform executables | `binaries/codemachine-<os>-<arch>/` |
| `bun run build:binaries:local` | **Local testing** | Build + install to node_modules | Same + local install |
| `npm install -g .` | **Global testing** | Test as if installed from npm | Global commands available |
| ~~`bun run build`~~ | ❌ **DEPRECATED** | Don't use (broken) | Use `build:binaries` instead |

---

## Use Cases

### I want to: Develop and Test Code Changes

```bash
# Run directly from source (fast, no compilation)
bun run dev

# With React DevTools for workflow UI debugging
bun run debug
```

**What happens:**
- Launches TUI directly from TypeScript source
- OpenTUI preload loaded dynamically via `launcher.ts`
- Hot module reloading (restart to see changes)
- No build step required

---

### I want to: Test Compiled Binaries Locally

```bash
# Step 1: Build and install locally
bun run build:binaries:local

# Step 2: Test using the wrapper (simulates npm install -g)
node bin/codemachine.js

# Step 3: Verify binaries directly
./node_modules/codemachine-<os>-<arch>/codemachine
./node_modules/codemachine-<os>-<arch>/codemachine-workflow
```

**What happens:**
1. Builds two compiled executables:
   - `codemachine` - Main TUI (SolidJS/OpenTUI)
   - `codemachine-workflow` - Workflow runner (React/Ink)
2. Copies platform package to `node_modules/codemachine-<os>-<arch>/`
3. Wrapper script (`bin/codemachine.js`) can now spawn the binary

**Why useful:**
- Tests production binaries without global installation
- Verifies wrapper → binary handoff works
- Safe testing (doesn't pollute global PATH)

---

### I want to: Test Global Installation (Like End Users)

**Option A: npm (Recommended for Windows)**
```bash
# Step 1: Build and install locally first
bun run build:binaries:local

# Step 2: Install globally with npm
npm install -g .

# Step 3: Test from anywhere
cd ~/some-project
cm --help
codemachine --help
```

**Option B: bun link (Linux/macOS)**
```bash
# All-in-one: build + local install + global link
bun run build:binaries:link

# Test from anywhere
cd ~/some-project
cm --help
codemachine --help
codemachine-workflow --help
```

**⚠️ Windows Note:** The `--link-global` flag may fail with EPERM (permissions error). Use Option A instead.

**What happens:**
- npm/bun registers the package globally
- Copies files to global installation directory
- Creates `cm.cmd` and `codemachine.cmd` wrappers (Windows)
- Adds to PATH automatically

---

### I want to: Publish a New Version

```bash
# 1. Build binaries on EACH platform (requires access to each OS)
# On Linux machine:
bun run build:binaries

# On macOS arm64 machine:
bun run build:binaries

# On macOS x64 machine:
bun run build:binaries

# On Windows machine:
bun run build:binaries

# 2. Publish EACH platform package
cd binaries/codemachine-linux-x64
npm publish

cd ../codemachine-darwin-arm64
npm publish

cd ../codemachine-darwin-x64
npm publish

cd ../codemachine-windows-x64
npm publish

# 3. Return to root and publish main package
cd ../..
npm publish

# Or use the release script (validates first)
bun run release
```

**Publishing Checklist:**
- [ ] Built on all 4 platforms (linux-x64, darwin-arm64, darwin-x64, windows-x64)
- [ ] Version numbers synced (automatic via build script)
- [ ] All platform packages published
- [ ] Main package published last
- [ ] Tested `npm install -g codemachine@<version>` on at least one platform

---

## Command Details

### `bun run dev`

**Purpose:** Development mode - run from source

**Command:**
```bash
DEBUG=true bun --conditions=browser src/runtime/cli-setup.ts
```

**Features:**
- No compilation needed
- Fast startup
- Easy debugging with Chrome DevTools
- SolidJS transform loaded dynamically

**When to use:** During active development when making code changes

---

### `bun run build:binaries`

**Purpose:** Build production executables for current platform

**What it builds:**
1. **Main TUI Binary** (`codemachine` or `codemachine.exe`)
   - Entry: `src/runtime/index.ts`
   - Includes: SolidJS plugin for OpenTUI transforms
   - Size: ~130 MB (includes Bun runtime)

2. **Workflow Runner Binary** (`codemachine-workflow` or `codemachine-workflow.exe`)
   - Entry: `src/workflows/runner-process.ts`
   - Includes: React/Ink only (no SolidJS)
   - Size: ~120 MB

**Output structure:**
```
binaries/codemachine-<os>-<arch>/
├── codemachine[.exe]           # Main binary
├── codemachine-workflow[.exe]  # Workflow binary
└── package.json                # With bin entries + cm alias
```

**Why two binaries?**
CodeMachine uses both SolidJS (TUI) and React (workflows). These JSX transforms conflict if loaded in the same process, so we separate them into two executables.

---

### `bun run build:binaries:local`

Same as `build:binaries` but also copies output to `node_modules/codemachine-<os>-<arch>/`

**Use this for:** Testing binaries locally without global installation

---

### `bun run build:binaries:link`

Same as `build:binaries:local` but also runs:
```bash
bun link                           # Register package
bun install --global <path>        # Install globally
```

**Use this for:** Testing global installation (Linux/macOS)

**⚠️ Known Issue (Windows):** May fail with EPERM. Use `npm install -g .` instead.

---

## Troubleshooting

### Error: `EPERM: failed copying files from cache` (Windows)

**When:** Running `bun run build:binaries:link` on Windows

**Why:** Bun's global install has permissions issues on Windows

**Solution:** Use npm instead:
```powershell
# Build and install locally first
bun run build:binaries:local

# Then install globally with npm (handles permissions better)
npm install -g .

# Test
cm --help
```

---

### Error: `No matching export in "node_modules/@opentui/solid/jsx-runtime.d.ts" for import "jsxDEV"`

**When:** Running `bun run build` (deprecated command)

**Why:** The old `build` command doesn't use the SolidJS transform plugin

**Solution:** Use `bun run build:binaries` instead

```bash
# ❌ Wrong
bun run build

# ✅ Correct
bun run build:binaries
```

---

### Error: `Platform binary not found`

**When:** Running `node bin/codemachine.js` after building

**Why:** The platform binary wasn't installed to `node_modules/`

**Solution:** Use `build:binaries:local` instead of `build:binaries`:
```bash
bun run build:binaries:local
node bin/codemachine.js
```

---

### Binaries are huge (120+ MB each)

**Why:** Bun's `--compile` includes the entire Bun runtime in each binary

**This is expected.** The binaries are standalone executables that don't require Bun or Node.js to be installed.

**Trade-off:**
- ✅ Zero dependencies (users don't need Bun/Node)
- ✅ Single-file distribution
- ❌ Large file size

---

## Architecture: Why Two Binaries?

CodeMachine uses a **dual JSX system**:

### The Problem
- **TUI Home Screen** (src/cli/tui/) → Uses SolidJS via OpenTUI
- **Workflow Execution UI** (src/ui/) → Uses React via Ink

**JSX transforms conflict** when both are loaded in the same process.

### The Solution: Process Separation

```
User runs: cm
│
├─→ Main Process: codemachine binary
│   ├─ Loads @opentui/solid/preload
│   ├─ Renders TUI home screen (SolidJS)
│   └─ When user types /start:
│       └─→ Spawns subprocess: codemachine-workflow
│           ├─ NO preload (clean environment)
│           ├─ Loads React/Ink
│           └─ Renders workflow execution UI
```

### File Organization

```
src/
├── cli/tui/                    # SolidJS + OpenTUI
│   ├── launcher.ts             # Conditionally loads preload
│   ├── app.tsx                 # /** @jsxImportSource @opentui/solid */
│   └── routes/
│
├── ui/                         # React + Ink
│   ├── components/             # NO JSX pragma (defaults to React)
│   └── contexts/
│
├── runtime/
│   ├── index.ts                # ← Entry for main binary
│   └── cli-setup.ts
│
└── workflows/
    └── runner-process.ts       # ← Entry for workflow binary
```

### Build Configuration

**Main Binary** (`codemachine`):
```javascript
await Bun.build({
  plugins: [solidPlugin],  // ← SolidJS transform
  entrypoints: ['./src/runtime/index.ts'],
  compile: { /* ... */ }
})
```

**Workflow Binary** (`codemachine-workflow`):
```javascript
await Bun.build({
  // NO solidPlugin - React only
  entrypoints: ['./src/workflows/runner-process.ts'],
  compile: { /* ... */ }
})
```

---

## Development Tips

### Fast Feedback Loop

```bash
# Make changes → restart
bun run dev

# No build step needed!
```

### Testing Before Publishing

```bash
# 1. Build locally
bun run build:binaries:local

# 2. Test wrapper
node bin/codemachine.js

# 3. Test binaries directly
./node_modules/codemachine-<os>-<arch>/codemachine
```

### Verifying Version Sync

The build script automatically syncs platform package versions from the main `package.json`:

```bash
# Before build:
{
  "version": "0.7.0",
  "optionalDependencies": {
    "codemachine-windows-x64": "0.6.0"  // ← Outdated
  }
}

# After running build:binaries:
{
  "version": "0.7.0",
  "optionalDependencies": {
    "codemachine-windows-x64": "0.7.0"  // ← Auto-synced!
  }
}
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build Binaries

on:
  workflow_dispatch:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-14, macos-13, windows-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.1.8

      - run: bun install --frozen-lockfile
      - run: bun run build:binaries

      # Verify cm alias exists
      - run: |
          if ! grep -q '"cm"' binaries/*/package.json; then
            echo "Error: cm alias missing"
            exit 1
          fi

      - uses: actions/upload-artifact@v4
        with:
          name: binaries-${{ matrix.os }}
          path: binaries/
```

---

## Related Documentation

- [README.md](./README.md) - Project overview and usage
- [CLAUDE.md](./CLAUDE.md) - AI development guidelines
- [package.json](./package.json) - All available scripts

---

## Summary

**For development:** `bun run dev`

**For local testing:** `bun run build:binaries:local`

**For global testing:** `npm install -g .`

**For production:** `bun run build:binaries` (on each platform)

**Don't use:** ~~`bun run build`~~ (deprecated, broken)

Got questions? Check the [Troubleshooting](#troubleshooting) section or open an issue!
