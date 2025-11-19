#!/usr/bin/env bun
import { mkdirSync, rmSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { platform, arch } from 'node:os';

// Detect current platform
const currentPlatform = platform();
const currentArch = arch();

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = join(repoRoot, 'package.json');
const mainPackage = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const mainVersion = mainPackage.version;

const args = new Set(process.argv.slice(2));
const installLocal = args.has('--install-local');
const linkGlobal = args.has('--link-global');

console.log('[build] Starting binary build...');
console.log(`[build] Main package version: ${mainVersion}`);

// Auto-sync platform package versions before building
if (mainPackage.optionalDependencies) {
  let needsSync = false;
  const outdated = [];

  for (const [pkgName, version] of Object.entries(mainPackage.optionalDependencies)) {
    if (version !== mainVersion) {
      needsSync = true;
      outdated.push(`${pkgName}: ${version} → ${mainVersion}`);
    }
  }

  if (needsSync) {
    console.log('[build] 🔄 Syncing platform package versions...');
    for (const update of outdated) {
      console.log(`[build]   ${update}`);
    }

    for (const pkgName of Object.keys(mainPackage.optionalDependencies)) {
      mainPackage.optionalDependencies[pkgName] = mainVersion;
    }

    writeFileSync(packageJsonPath, JSON.stringify(mainPackage, null, 2) + '\n');
    console.log('[build] ✅ Version sync complete\n');
  } else {
    console.log('[build] ✅ Platform package versions already synced\n');
  }
}

console.log(`[build] Current platform: ${currentPlatform}-${currentArch}\n`);

// Load OpenTUI solid plugin for JSX transformation
const solidPluginPath = resolve(repoRoot, 'node_modules/@opentui/solid/scripts/solid-plugin.ts');
const solidPlugin = (await import(solidPluginPath)).default;

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

console.log(`[build] Building compiled executables for ${target}...`);
mkdirSync(outdir, { recursive: true });

try {
  // Build TWO separate executables to prevent JSX runtime conflicts:
  // 1. Main TUI executable (with SolidJS transform)
  // 2. Workflow runner executable (NO SolidJS transform, React/Ink only)

  console.log('[build] Building main TUI executable...');
  const binaryPath = join(outdir, `codemachine${ext}`);

  const result = await Bun.build({
    conditions: ['browser'],
    tsconfig: './tsconfig.json',
    plugins: [solidPlugin], // SolidJS transform for TUI
    sourcemap: 'external',
    minify: true,
    compile: {
      target: target,
      outfile: binaryPath,
    },
    entrypoints: ['./src/runtime/index.ts'],
  });

  if (!result.success) {
    console.error('[build] ❌ Main TUI build failed:');
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  console.log('[build] ✅ Main TUI executable built');
  console.log('[build] Building workflow runner executable...');

  const workflowBinaryPath = join(outdir, `codemachine-workflow${ext}`);

  const workflowResult = await Bun.build({
    conditions: ['browser'],
    tsconfig: './tsconfig.json',
    // NO SolidJS plugin - React/Ink JSX only
    sourcemap: 'external',
    minify: true,
    compile: {
      target: target,
      outfile: workflowBinaryPath,
    },
    entrypoints: ['./src/workflows/runner-process.ts'],
  });

  if (!workflowResult.success) {
    console.error('[build] ❌ Workflow runner build failed:');
    for (const log of workflowResult.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  console.log('[build] ✅ Workflow runner executable built');

  // Create package.json for the platform-specific package
  const pkgName = `codemachine-${os}-${archName}`;
  const binEntries = {
    codemachine: `./codemachine${ext}`,
    'codemachine-workflow': `./codemachine-workflow${ext}`,
    cm: `./codemachine${ext}`,
  };

  const pkg = {
    name: pkgName,
    version: mainVersion,
    description: `${mainPackage.description} (prebuilt ${os}-${archName} binaries)`,
    os: [os],
    cpu: [archName],
    files: ['codemachine' + ext, 'codemachine-workflow' + ext],
    bin: binEntries,
  };

  await Bun.write(
    join(outdir, 'package.json'),
    JSON.stringify(pkg, null, 2)
  );

  console.log(`[build] ✅ Successfully built executables:`);
  console.log(`[build]   - ${outdir}/codemachine${ext} (TUI)`);
  console.log(`[build]   - ${outdir}/codemachine-workflow${ext} (Workflow runner)`);

  if (installLocal) {
    const localPkgDir = join(repoRoot, 'node_modules', pkgName);
    rmSync(localPkgDir, { recursive: true, force: true });
    mkdirSync(join(repoRoot, 'node_modules'), { recursive: true });
    cpSync(outdir, localPkgDir, { recursive: true });
    console.log(`[build] 🔗 Installed local binary package at ${localPkgDir}`);
  }

  if (linkGlobal) {
    console.log('[build] 🔗 Linking platform package globally via bun link...');
    const linkProcess = Bun.spawn(['bun', 'link'], {
      cwd: outdir,
      stdout: 'inherit',
      stderr: 'inherit',
    });
    const linkExit = await linkProcess.exited;
    if (linkExit !== 0) {
      console.warn('[build] ⚠️ bun link failed for platform package');
    } else {
      console.log('[build] 🔗 Installing global shim via bun install...');
      const installTarget = pathToFileURL(resolve(outdir)).href;
      const installProcess = Bun.spawn(['bun', 'install', '--global', installTarget], {
        stdout: 'inherit',
        stderr: 'inherit',
      });
      const installExit = await installProcess.exited;
      if (installExit !== 0) {
        console.warn('[build] ⚠️ bun install --global failed for platform package');
      }
    }
  }

  console.log('[build] 🎉 Build complete!\n');
  console.log('[build] Note: This script builds for the current platform only.');
  console.log('[build] For cross-platform builds, run this script on each target platform.');

} catch (error) {
  console.error(`[build] ❌ Error during build:`, error.message);
  console.error(error);
  process.exit(1);
}
