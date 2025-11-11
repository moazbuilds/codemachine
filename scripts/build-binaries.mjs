#!/usr/bin/env bun
import { mkdirSync } from 'fs';
import { join } from 'path';
import { platform, arch } from 'os';

// Detect current platform
const currentPlatform = platform();
const currentArch = arch();

console.log('[build] Starting binary build...');
console.log(`[build] Current platform: ${currentPlatform}-${currentArch}\n`);

// Map platform/arch to target names
const platformMap = {
  'linux-x64': { target: 'bun-linux-x64', os: 'linux', arch: 'x64', ext: '' },
  'darwin-arm64': { target: 'bun-darwin-arm64', os: 'darwin', arch: 'arm64', ext: '' },
  'darwin-x64': { target: 'bun-darwin-x64', os: 'darwin', arch: 'x64', ext: '' },
  'win32-x64': { target: 'bun-windows-x64', os: 'windows', arch: 'x64', ext: '.exe' },
};

const platformKey = `${currentPlatform}-${currentArch}`;
const platformConfig = platformMap[platformKey];

if (!platformConfig) {
  console.error(`[build] ❌ Unsupported platform: ${platformKey}`);
  console.error('[build] Supported platforms:', Object.keys(platformMap).join(', '));
  process.exit(1);
}

const { target, os, arch: archName, ext } = platformConfig;
const outdir = join('./binaries', `codemachine-${os}-${archName}`);

console.log(`[build] Building compiled executable for ${target}...`);
mkdirSync(outdir, { recursive: true });

try {
  // Build standalone executable with embedded Bun runtime using CLI
  const binaryPath = join(outdir, `codemachine${ext}`);

  // Use the current Bun executable path
  const bunPath = process.execPath;

  const proc = Bun.spawn([
    bunPath,
    'build',
    '--compile',
    '--outfile',
    binaryPath,
    `--target=${target}`,
    '--minify',
    './src/runtime/index.ts'
  ], {
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    console.error(`[build] ❌ Build failed with exit code ${exitCode}`);
    process.exit(1);
  }

  // Create package.json for the platform-specific package
  const pkg = {
    name: `codemachine-${os}-${archName}`,
    version: "0.5.0", // TODO: Read from main package.json
    os: [os],
    cpu: [archName],
    bin: {
      codemachine: `./codemachine${ext}`
    },
  };

  await Bun.write(
    join(outdir, 'package.json'),
    JSON.stringify(pkg, null, 2)
  );

  console.log(`[build] ✅ Successfully built executable: ${outdir}/codemachine${ext}`);
  console.log('[build] 🎉 Build complete!\n');
  console.log('[build] Note: This script builds for the current platform only.');
  console.log('[build] For cross-platform builds, run this script on each target platform.');

} catch (error) {
  console.error(`[build] ❌ Error during build:`, error.message);
  console.error(error);
  process.exit(1);
}
