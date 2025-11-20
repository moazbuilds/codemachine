#!/usr/bin/env bun
/**
 * Workflow Runner Process
 *
 * Executes workflows in a separate Bun process WITHOUT the SolidJS transform plugin.
 * This prevents JSX conflicts between OpenTUI (SolidJS) and workflow UI (React/Ink).
 *
 * Architecture:
 * - Process 1: TUI home screen (SolidJS/OpenTUI) with preload active
 * - Process 2: This file - Workflow execution (React/Ink) with NO preload
 *
 * When the user types /start in the TUI, the TUI process spawns this script
 * as a subprocess, passing terminal control to it. The workflow runs with
 * clean React/Ink rendering, then exits when complete.
 *
 * Usage:
 *   bun runner-process.ts <cwd> [specificationPath]
 */

// SET CODEMACHINE_INSTALL_DIR EARLY
// Prefer explicit env hints, then fall back to searching from the entry file
if (!process.env.CODEMACHINE_INSTALL_DIR) {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const trySetInstallDir = (candidate?: string | null): boolean => {
    if (!candidate) return false;
    const pkgPath = path.join(candidate, 'package.json');
    if (!fs.existsSync(pkgPath)) return false;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg?.name === 'codemachine') {
        process.env.CODEMACHINE_INSTALL_DIR = candidate;
        return true;
      }
    } catch {
      // ignore parse failure
    }
    return false;
  };

  const envCandidates = [
    process.env.CODEMACHINE_PACKAGE_ROOT,
    process.env.CODEMACHINE_PACKAGE_JSON
      ? path.dirname(process.env.CODEMACHINE_PACKAGE_JSON)
      : undefined,
  ];

  let resolved = envCandidates.some((candidate) => trySetInstallDir(candidate));

  if (!resolved) {
    const scriptPath = process.argv[1];
    const thisFileDir = scriptPath && !scriptPath.includes('$bunfs')
      ? path.dirname(scriptPath)
      : ((import.meta as any).dir || path.dirname(new URL(import.meta.url).pathname));
    let current = thisFileDir;

    for (let i = 0; i < 10; i++) {
      const pkgPath = path.join(current, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg?.name === 'codemachine') {
            process.env.CODEMACHINE_INSTALL_DIR = current;
            resolved = true;
            break;
          }
        } catch {
          // ignore parse failure
        }
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
}

import { runWorkflowQueue } from './execution/index.js';

// Parse command line arguments
const [_bunPath, _scriptPath, cwd, specificationPath = ''] = process.argv;

if (!cwd) {
  console.error('Error: Missing required argument <cwd>');
  console.error('Usage: bun runner-process.ts <cwd> [specificationPath]');
  process.exit(1);
}

// Run the workflow queue with React/Ink UI
// Since this process never imports @opentui/solid/preload,
// all JSX is compiled correctly for React
try {
  await runWorkflowQueue({ cwd, specificationPath });
  process.exit(0);
} catch (error) {
  console.error('Workflow execution failed:', error);
  process.exit(1);
}
