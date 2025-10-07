#!/usr/bin/env node
import { execSync } from 'child_process';

const execCommand = (cmd, description) => {
  console.log(`[validate] ${description}...`);
  execSync(cmd, { stdio: 'inherit' });
};

try {
  execCommand('npm run lint', 'Running lint');
  execCommand('npm run typecheck', 'Running typecheck');
  execCommand('npm run test -- --run', 'Running tests');
  console.log('[validate] All checks passed!');
} catch (error) {
  console.error('[validate] Validation failed');
  process.exit(1);
}
