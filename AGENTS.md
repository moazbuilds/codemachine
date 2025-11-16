# Claude Development Guidelines

This document provides essential guidelines for AI assistants working on the CodeMachine codebase, particularly for the Bun migration and OpenTUI integration.

## Table of Contents
- [Finding Context & Implementations](#finding-context--implementations)
- [Error Handling](#error-handling)
- [Type Checking & Linting](#type-checking--linting)
- [Architecture Overview](#architecture-overview)
- [Common Patterns](#common-patterns)

---

## Finding Context & Implementations

### Reference Repositories

**Primary Reference: OpenCode**
- Location: `/tmp/opencode-research/opencode/`
- Key directory: `packages/opencode/src/cli/cmd/tui/`
- **ALWAYS check OpenCode before implementing OpenTUI components**

**Secondary Reference: OpenTUI Core**
- Repository: `https://github.com/sst/opentui`
- Clone to `/tmp/opentui/` when needed for API reference
- Key directories:
  - `packages/core/src/` - Core types and renderables
  - `packages/solid/` - SolidJS integration
  - `packages/core/src/post/filters.ts` - Visual effects

### Research Workflow

When implementing a new OpenTUI feature:

```bash
# 1. Search OpenCode for similar implementation
grep -r "pattern" /tmp/opencode-research/opencode/packages/opencode/src/cli/cmd/tui/

# 2. Read the relevant file
cat /tmp/opencode-research/opencode/packages/opencode/src/cli/cmd/tui/[file]

# 3. Check OpenTUI types if needed
cat /tmp/opentui/packages/core/src/types.ts
cat /tmp/opentui/packages/core/src/renderables/Box.ts
```

### Critical Files to Reference

**OpenCode TUI Structure:**
```
/tmp/opencode-research/opencode/packages/opencode/src/cli/cmd/tui/
├── app.tsx                    # Provider stack, background detection
├── context/
│   ├── helper.tsx            # createSimpleContext pattern
│   ├── theme.tsx             # RGBA color resolution
│   ├── kv.tsx                # Persistent storage
│   └── dialog.tsx            # Modal dialogs
├── component/
│   ├── logo.tsx              # ASCII art pattern
│   └── prompt/               # Input with autocomplete
└── ui/
    ├── toast.tsx             # Notification system
    └── dialog.tsx            # Dialog overlay
```

### Key Implementation Patterns

**1. JSX Pragma**
```typescript
/** @jsxImportSource @opentui/solid */
```
- REQUIRED at top of EVERY TUI file
- NOT `solid-js` - use `@opentui/solid`

**2. Context Creation**
```typescript
import { createSimpleContext } from "@tui/context/helper"

export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme",
  init: (props: { mode: "dark" | "light" }) => {
    // Return context value
    return { theme, mode }
  }
})
```

**3. Color Resolution**
```typescript
import { RGBA } from "@opentui/core"

// Always use RGBA objects, not strings
const color = RGBA.fromHex("#00D9FF")
const transparent = RGBA.fromValues(0, 0, 0, 0)
```

**4. Border Syntax**
```typescript
// ❌ WRONG - "all" is not valid
border={["all"]}

// ✅ CORRECT
border={["top", "bottom", "left", "right"]}
```

**5. Provider Nesting Order**
```typescript
<KVProvider>           {/* Storage first */}
  <ToastProvider>      {/* Notifications */}
    <ThemeProvider>    {/* Theme/colors */}
      <DialogProvider> {/* Modals */}
        <SessionProvider> {/* App state */}
          <App />
        </SessionProvider>
      </DialogProvider>
    </ThemeProvider>
  </ToastProvider>
</KVProvider>
```

---

## Error Handling

### Validation Workflow

**CRITICAL: Always validate after changes**

```bash
# 1. Run typecheck FIRST
bun run typecheck 2>&1 | grep -E "(src/cli/tui/|error TS|Found [0-9]+ error)"

# 2. Fix errors, then run lint
bun run lint

# 3. Test the application
bun run dev
```

### Common TypeScript Errors

#### Error 1: JSX Export Not Found
```
SyntaxError: Export named 'jsxDEV' not found in module '@opentui/solid/jsx-runtime.d.ts'
```

**Solution:** Add to `bunfig.toml`:
```toml
preload = ["@opentui/solid/preload"]
```

#### Error 2: Border Type Error
```
Type '"all"' is not assignable to type 'BorderSides'
```

**Solution:** Use array of sides:
```typescript
border={["top", "bottom", "left", "right"]}
```

#### Error 3: Context Provider Type Mismatch
```
Type '{ children: any; }' is not assignable to type 'ParentProps<Record<string, never>>'
```

**Solution:** Ensure `createSimpleContext` uses correct generic type:
```typescript
export function createSimpleContext<T, Props extends Record<string, any>>(input: {
  name: string
  init: ((input: Props) => T) | (() => T)
})
```

#### Error 4: Module Not Found
```
Cannot find module '@/global'
```

**Solution:** Check if importing OpenCode-specific modules. Use CodeMachine equivalents:
```typescript
// ❌ WRONG (OpenCode-specific)
import { Global } from "@/global"
const statePath = Global.Path.state

// ✅ CORRECT (CodeMachine)
import { homedir } from "os"
import path from "path"
const statePath = path.join(homedir(), ".codemachine", "state")
```

### Error Investigation Pattern

1. **Read the error message carefully**
2. **Search OpenCode for similar code:**
   ```bash
   grep -r "error pattern" /tmp/opencode-research/opencode/
   ```
3. **Check OpenTUI types:**
   ```bash
   cat /tmp/opentui/packages/core/src/types.ts
   ```
4. **Verify tsconfig.json and bunfig.toml are correct**
5. **Run typecheck again to confirm fix**

---

## Type Checking & Linting

### Pre-Implementation Checklist

Before writing code:
- [ ] Check OpenCode reference implementation
- [ ] Verify JSX pragma: `/** @jsxImportSource @opentui/solid */`
- [ ] Ensure imports use `@tui/*` path alias
- [ ] Plan context dependencies

### Post-Implementation Checklist

After writing code:
- [ ] Run `bun run typecheck` - **0 errors required**
- [ ] Run `bun run lint` - **0 warnings/errors**
- [ ] Test with `bun run dev`
- [ ] Verify visual output

### TypeScript Configuration

**tsconfig.json requirements:**
```json
{
  "compilerOptions": {
    "jsx": "preserve",              // NOT "react-jsx"
    "lib": ["ES2022", "DOM"],       // DOM needed for OpenTUI types
    "types": ["bun", "node"],       // Remove "react" if present
    "paths": {
      "@tui/*": ["./src/cli/tui/*"] // Path alias for TUI imports
    }
  }
}
```

**bunfig.toml requirements:**
```toml
# REQUIRED for OpenTUI JSX runtime
preload = ["@opentui/solid/preload"]

[test]
preload = ["./tests/setup.ts"]
```

### Incremental Validation

When implementing multiple files:
```bash
# After each file
bun run typecheck 2>&1 | grep "src/cli/tui/"

# If errors found, fix BEFORE moving to next file
# This prevents error cascade
```

### Linting Rules

**Import order:**
1. External dependencies (`solid-js`, `@opentui/solid`)
2. Internal utilities (`@tui/context/*`, `@tui/component/*`)
3. Types (`import type { ... }`)

**Naming conventions:**
- Components: PascalCase (`Logo`, `HelpRow`)
- Files: kebab-case (`help-row.tsx`)
- Contexts: camelCase hooks (`useTheme`, `useDialog`)
- Providers: PascalCase (`ThemeProvider`)

---

## Architecture Overview

### Dual JSX System

CodeMachine uses **both React (Ink) and SolidJS (OpenTUI)**:

```
src/
├── ui/                    # React + Ink (workflow execution UI)
│   └── *.tsx             # Uses React JSX
└── cli/tui/              # SolidJS + OpenTUI (home screen)
    └── *.tsx             # Uses @opentui/solid JSX pragma
```

**Key Point:** `jsx: "preserve"` in tsconfig allows per-file JSX control via pragma.

### Layer Architecture

```
┌─────────────────────────────────────┐
│           app.tsx                    │  Entry point, provider stack
├─────────────────────────────────────┤
│        routes/home.tsx               │  Main layout, command handlers
├─────────────────────────────────────┤
│     components/ + ui/                │  Reusable UI components
├─────────────────────────────────────┤
│         context/                     │  State management
├─────────────────────────────────────┤
│    @opentui/solid + @opentui/core   │  Framework layer
└─────────────────────────────────────┘
```

### Context Dependencies

```
KV (storage) ─┐
              ├──> Toast
              │
Toast ────────┼──> Theme
              │
Theme ────────┼──> Dialog ──> Session
              │      ↓
              │   (uses Toast + Renderer)
              │
              └──> App
```

**Critical:** Contexts must be nested in correct order (see Provider Nesting Order above).

---

## Common Patterns

### Suspend/Resume Pattern (External Commands)

For commands like `codex login` that need full terminal control:

```typescript
const dialog = useDialog()
const renderer = useRenderer()

await dialog.handleInteractiveCommand(
  "Authentication",
  async () => {
    // This runs with suspended TUI:
    // 1. renderer.suspend() releases terminal
    // 2. Command runs (can use console, prompts, etc.)
    // 3. renderer.resume() restores TUI
    await handleLogin(providerId)
  }
)
```

**Location:** `src/cli/tui/context/dialog.tsx:37`

### Background Detection

Terminal background color auto-detection:

```typescript
async function getTerminalBackgroundColor(): Promise<"dark" | "light"> {
  if (!process.stdin.isTTY) return "dark"

  return new Promise((resolve) => {
    // Send OSC 11 query
    process.stdout.write("\x1b]11;?\x07")

    // Parse response: rgb:RRRR/GGGG/BBBB
    // Calculate luminance
    // Return "dark" or "light"
  })
}
```

**Location:** `src/cli/tui/app.tsx:33`
**Reference:** `/tmp/opencode-research/opencode/packages/opencode/src/cli/cmd/tui/app.tsx:33`

### Theme Resolution

Multi-level color reference resolution:

```json
{
  "defs": {
    "darkStep9": "#00D9FF",
    "darkGreen": "#10b981"
  },
  "theme": {
    "primary": { "dark": "darkStep9", "light": "#0891b2" }
  }
}
```

Resolver handles: Hex → Ref → Variant → RGBA

**Location:** `src/cli/tui/context/theme.tsx:38`

### Toast Auto-Dismiss

```typescript
show(options: ToastOptions) {
  const { duration = 3000, ...rest } = options
  setStore("current", rest)

  if (timeoutHandle) clearTimeout(timeoutHandle)
  timeoutHandle = setTimeout(() => setStore("current", null), duration)
}
```

**Location:** `src/cli/tui/context/toast.tsx`

---

## Quick Reference Commands

```bash
# Validation
bun run typecheck                          # Type checking
bun run lint                               # Linting
bun run dev                                # Test application

# Research
grep -r "pattern" /tmp/opencode-research/opencode/packages/opencode/src/cli/cmd/tui/
cat /tmp/opentui/packages/core/src/types.ts

# Path aliases
@tui/*          → src/cli/tui/*
@opentui/solid  → node_modules/@opentui/solid
@opentui/core   → node_modules/@opentui/core
```

---

## Critical Reminders

1. **ALWAYS** check OpenCode reference before implementing
2. **ALWAYS** run typecheck after changes
3. **NEVER** use `border={["all"]}` - use explicit sides
4. **NEVER** forget JSX pragma: `/** @jsxImportSource @opentui/solid */`
5. **NEVER** use `@/global` - CodeMachine doesn't have it
6. **ALWAYS** use `RGBA` objects for colors, not strings
7. **ALWAYS** ensure `bunfig.toml` has OpenTUI preload
8. **ALWAYS** validate provider nesting order

---

## Related Documentation

- OpenTUI Core: `/tmp/opentui/README.md`
- OpenCode Reference: `/tmp/opencode-research/opencode/README.md`
- Package Docs: `node_modules/@opentui/solid/README.md`
- Color Effects: `/tmp/opentui/packages/core/src/post/filters.ts`

---

*Last Updated: 2025-11-15*
*For the CodeMachine Bun Migration Project*
