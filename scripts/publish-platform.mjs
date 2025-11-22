#!/usr/bin/env bun
import { execSync } from 'child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { platform, arch } from 'node:os';

// Simple ANSI colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const dim = '\x1b[2m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

// Map platform/arch to package names
const platformMap = {
  'linux-x64': 'codemachine-linux-x64',
  'darwin-arm64': 'codemachine-darwin-arm64',
  'darwin-x64': 'codemachine-darwin-x64',
  'win32-x64': 'codemachine-windows-x64',
};

const currentPlatform = platform();
const currentArch = arch();
const platformKey = `${currentPlatform}-${currentArch}`;
const packageName = platformMap[platformKey];

if (!packageName) {
  console.error(`${red}✗${reset} Unsupported platform: ${bold}${platformKey}${reset}`);
  console.error(`${dim}Supported:${reset} ${Object.keys(platformMap).join(', ')}`);
  process.exit(1);
}

const packageDir = join('./binaries', packageName);

if (!existsSync(packageDir)) {
  console.error(`${red}✗${reset} Package directory not found: ${packageDir}`);
  console.error(`${yellow}⟳${reset} Run ${bold}bun run build${reset} first to build binaries`);
  process.exit(1);
}

// Parse arguments
let dryRun = false;
let tag = 'latest';
let access = 'public';

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--dry-run':
      dryRun = true;
      break;
    case '--tag':
      if (i + 1 >= args.length) {
        console.error(`${red}✗${reset} --tag requires a value`);
        process.exit(1);
      }
      i++;
      tag = args[i];
      break;
    case '--access':
      if (i + 1 >= args.length) {
        console.error(`${red}✗${reset} --access requires a value`);
        process.exit(1);
      }
      i++;
      access = args[i];
      break;
    default:
      console.error(`${red}✗${reset} Unknown option: ${args[i]}`);
      process.exit(1);
  }
}

console.log(`\n${bold}${cyan}╭────────────────────────────────────────╮${reset}`);
console.log(`${bold}${cyan}│${reset}  Publishing Platform Package  ${bold}${cyan}│${reset}`);
console.log(`${bold}${cyan}╰────────────────────────────────────────╯${reset}\n`);

console.log(`${dim}Package:${reset} ${bold}${packageName}${reset}`);
console.log(`${dim}Directory:${reset} ${packageDir}`);
console.log(`${dim}Tag:${reset} ${tag}`);
console.log(`${dim}Access:${reset} ${access}`);
console.log(`${dim}Dry run:${reset} ${dryRun ? 'yes' : 'no'}\n`);

try {
  // Verify npm authentication (skip in CI if NODE_AUTH_TOKEN is set)
  const isCI = process.env.CI === 'true' || process.env.NODE_AUTH_TOKEN;

  if (!isCI) {
    console.log(`${cyan}→${reset} Verifying npm authentication...`);
    try {
      execSync('npm whoami', { stdio: 'pipe' });
      console.log(`${green}✓${reset} ${dim}Authenticated${reset}\n`);
    } catch {
      console.error(`${red}✗${reset} Not logged in to npm. Run ${bold}npm login${reset} first.`);
      process.exit(1);
    }
  } else {
    console.log(`${cyan}→${reset} Running in CI mode with NODE_AUTH_TOKEN\n`);
  }

  // Build publish command
  const publishCmd = dryRun
    ? `npm publish --dry-run --tag ${tag} --access ${access}`
    : `npm publish --tag ${tag} --access ${access}`;

  console.log(`${cyan}→${reset} Publishing ${packageName}...`);
  if (dryRun) {
    console.log(`${yellow}ℹ${reset} ${dim}Dry run mode - no actual publish${reset}`);
  }

  execSync(publishCmd, {
    cwd: packageDir,
    stdio: 'inherit',
  });

  if (!dryRun) {
    console.log(`\n${green}✓${reset} ${bold}Published successfully!${reset}`);
    console.log(`\n${dim}View at:${reset} https://www.npmjs.com/package/${packageName}\n`);
  } else {
    console.log(`\n${green}✓${reset} ${bold}Dry run complete${reset}\n`);
  }
} catch (error) {
  console.error(`\n${red}✗${reset} ${bold}Publish failed${reset}`);
  if (error.message) {
    console.error(`${dim}${error.message}${reset}`);
  }
  process.exit(1);
}
