#!/usr/bin/env bun
import { execSync } from 'child_process';

// Get the path to the current bun executable
const bunPath = process.execPath;

const execCommand = (cmd, description) => {
  console.log(`[validate] ${description}...`);
  execSync(cmd, { stdio: 'inherit' });
};

try {
  execCommand(`${bunPath} run lint`, 'Running lint');
  execCommand(`${bunPath} run typecheck`, 'Running typecheck');
  execCommand(`${bunPath} test`, 'Running tests');
  console.log('[validate] All checks passed!');
} catch (error) {
  console.error('[validate] Validation failed');
  process.exit(1);
}
