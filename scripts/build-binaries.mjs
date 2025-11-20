#!/usr/bin/env bun
import { mkdirSync, rmSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform, arch } from 'node:os';
import { generateEmbeddedResources } from './generate-embedded-resources.mjs';

// Simple ANSI colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const dim = '\x1b[2m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

// Detect current platform
const currentPlatform = platform();
const currentArch = arch();

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = join(repoRoot, 'package.json');
const mainPackage = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const mainVersion = mainPackage.version;

console.log(`\n${bold}${cyan}╭────────────────────────────────────────╮${reset}`);
console.log(`${bold}${cyan}│${reset}  Building ${bold}CodeMachine${reset} v${mainVersion}  ${bold}${cyan}│${reset}`);
console.log(`${bold}${cyan}╰────────────────────────────────────────╯${reset}\n`);

await generateEmbeddedResources({ quiet: true, writeStub: false });
console.log(`${green}✓${reset} ${dim}Embedded resources refreshed${reset}`);

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
    console.log(`${yellow}⟳${reset} Syncing platform package versions...`);
    for (const update of outdated) {
      console.log(`  ${dim}${update}${reset}`);
    }

    for (const pkgName of Object.keys(mainPackage.optionalDependencies)) {
      mainPackage.optionalDependencies[pkgName] = mainVersion;
    }

    writeFileSync(packageJsonPath, JSON.stringify(mainPackage, null, 2) + '\n');
    console.log(`${green}✓${reset} ${dim}Version sync complete${reset}\n`);
  } else {
    console.log(`${green}✓${reset} ${dim}Platform package versions synced${reset}`);
  }
}

console.log(`\n${dim}Platform:${reset} ${bold}${currentPlatform}-${currentArch}${reset}\n`);

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
  console.error(`${red}✗${reset} Unsupported platform: ${bold}${platformKey}${reset}`);
  console.error(`${dim}Supported:${reset} ${Object.keys(platformMap).join(', ')}`);
  process.exit(1);
}

const { target, os, arch: archName, ext } = platformConfig;
const outdir = join('./binaries', `codemachine-${os}-${archName}`);

console.log(`${cyan}→${reset} Building executables for ${dim}${target}${reset}...`);
mkdirSync(outdir, { recursive: true });

try {
  // Build TWO separate executables to prevent JSX runtime conflicts:
  // 1. Main TUI executable (with SolidJS transform)
  // 2. Workflow runner executable (NO SolidJS transform, React/Ink only)

  console.log(`  ${dim}├─${reset} Main TUI executable...`);
  const binaryPath = join(outdir, `codemachine${ext}`);

  const result = await Bun.build({
    conditions: ['browser'],
    tsconfig: './tsconfig.json',
    plugins: [solidPlugin], // SolidJS transform for TUI
    minify: true,
    define: {
      __CODEMACHINE_VERSION__: JSON.stringify(mainVersion),
    },
    compile: {
      target: target,
      outfile: binaryPath,
    },
    entrypoints: ['./src/runtime/index.ts'],
  });

  if (!result.success) {
    console.error(`  ${red}✗${reset} Main TUI build failed:`);
    for (const log of result.logs) {
      console.error(`    ${dim}${log}${reset}`);
    }
    process.exit(1);
  }

  console.log(`  ${green}✓${reset} ${dim}Main TUI built${reset}`);
  console.log(`  ${dim}├─${reset} Workflow runner executable...`);

  const workflowBinaryPath = join(outdir, `codemachine-workflow${ext}`);

  const workflowResult = await Bun.build({
    conditions: ['browser'],
    tsconfig: './tsconfig.json',
    // NO SolidJS plugin - React/Ink JSX only
    minify: true,
    define: {
      __CODEMACHINE_VERSION__: JSON.stringify(mainVersion),
    },
    compile: {
      target: target,
      outfile: workflowBinaryPath,
    },
    entrypoints: ['./src/workflows/runner-process.ts'],
  });

  if (!workflowResult.success) {
    console.error(`  ${red}✗${reset} Workflow runner build failed:`);
    for (const log of workflowResult.logs) {
      console.error(`    ${dim}${log}${reset}`);
    }
    process.exit(1);
  }

  console.log(`  ${green}✓${reset} ${dim}Workflow runner built${reset}`);

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

  const localPkgDir = join(repoRoot, 'node_modules', pkgName);
  rmSync(localPkgDir, { recursive: true, force: true });
  mkdirSync(join(repoRoot, 'node_modules'), { recursive: true });
  cpSync(outdir, localPkgDir, { recursive: true });

  console.log(`\n${green}✓${reset} ${bold}Build complete!${reset}\n`);
  console.log(`${dim}Binaries:${reset}`);
  console.log(`  • ${outdir}/codemachine${ext}`);
  console.log(`  • ${outdir}/codemachine-workflow${ext}`);
  console.log(`\n${dim}Installed to:${reset} ${localPkgDir}`);
  console.log(`\n${cyan}ℹ${reset} ${dim}Note: Builds for current platform only (${platformKey})${reset}\n`);

} catch (error) {
  console.error(`\n${red}✗${reset} ${bold}Build failed${reset}`);
  console.error(`${dim}${error.message}${reset}`);
  if (error.stack) {
    console.error(`\n${dim}${error.stack}${reset}`);
  }
  process.exit(1);
}
