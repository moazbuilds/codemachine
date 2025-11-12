#!/usr/bin/env node

/**
 * Shell wrapper for CodeMachine CLI
 *
 * This wrapper detects the user's platform and spawns the correct
 * platform-specific binary from the appropriate optional dependency.
 *
 * The actual binaries are distributed as separate packages:
 * - codemachine-linux-x64
 * - codemachine-darwin-arm64
 * - codemachine-darwin-x64
 * - codemachine-windows-x64
 */

const { spawn } = require('child_process');
const { join, dirname } = require('path');
const { existsSync } = require('fs');
const { platform, arch } = require('os');

// Map Node.js platform/arch to our package names
const platformMap = {
  'linux-x64': { pkg: 'codemachine-linux-x64', bin: 'codemachine' },
  'darwin-arm64': { pkg: 'codemachine-darwin-arm64', bin: 'codemachine' },
  'darwin-x64': { pkg: 'codemachine-darwin-x64', bin: 'codemachine' },
  'win32-x64': { pkg: 'codemachine-windows-x64', bin: 'codemachine.exe' },
};

const currentPlatform = platform();
const currentArch = arch();
const platformKey = `${currentPlatform}-${currentArch}`;
const platformConfig = platformMap[platformKey];

if (!platformConfig) {
  console.error(`Error: Unsupported platform ${platformKey}`);
  console.error(`Supported platforms: ${Object.keys(platformMap).join(', ')}`);
  process.exit(1);
}

// Try to find the platform-specific binary
// Look in node_modules relative to this wrapper
const rootDir = join(__dirname, '..');
const binaryPath = join(rootDir, 'node_modules', platformConfig.pkg, platformConfig.bin);

if (!existsSync(binaryPath)) {
  console.error(`Error: Platform binary not found at ${binaryPath}`);
  console.error(`\nThe ${platformConfig.pkg} package may not be installed.`);
  console.error(`This is likely because your platform is not supported as an optional dependency.`);
  console.error(`\nPlease report this issue at: https://github.com/moazbuilds/CodeMachine-CLI/issues`);
  process.exit(1);
}

// Spawn the platform-specific binary with the user's arguments
const child = spawn(binaryPath, process.argv.slice(2), {
  stdio: 'inherit',
  windowsHide: false,
});

// Forward exit code
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});

// Handle errors
child.on('error', (error) => {
  console.error('Error spawning binary:', error.message);
  process.exit(1);
});
