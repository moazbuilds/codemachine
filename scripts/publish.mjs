#!/usr/bin/env node
import { execSync } from 'child_process';

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
      tag = args[++i];
      break;
    default:
      console.error(`[publish] Unknown option: ${args[i]}`);
      process.exit(1);
  }
}

console.log(`[publish] Dry run: ${dryRun}`);
console.log(`[publish] Using tag: ${tag}`);

const execCommand = (cmd, description) => {
  console.log(`[publish] ${description}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (error) {
    console.error(`[publish] ${description} failed`);
    process.exit(1);
  }
};

try {
  // Verify clean git worktree
  console.log('[publish] Verifying clean git worktree');
  const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
  if (gitStatus.trim()) {
    console.error('[publish] Worktree is not clean; commit or stash changes before publishing.');
    process.exit(1);
  }

  // Verify npm authentication
  console.log('[publish] Verifying npm authentication');
  execSync('npm whoami', { stdio: 'pipe' });

  // Run build, test, and lint
  execCommand('npm run build', 'Running npm run build');
  execCommand('npm run test', 'Running npm run test');
  execCommand('npm run lint', 'Running npm run lint');

  // Publish
  const publishCmd = `npm publish --tag ${tag}`;

  if (dryRun) {
    console.log('[publish] Dry run enabled; publish command:');
    console.log(`[publish] ${publishCmd}`);
  } else {
    console.log('[publish] Publishing to npm');
    execSync(publishCmd, { stdio: 'inherit' });
  }

  console.log('[publish] Release complete');
} catch (error) {
  console.error('[publish] Release failed');
  process.exit(1);
}
