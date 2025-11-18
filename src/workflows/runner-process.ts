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
