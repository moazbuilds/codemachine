#!/usr/bin/env bun
import { mkdirSync, rmSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform, arch } from 'node:os';
import { generateEmbeddedResources } from './generate-embedded-resources.mjs';
import { $ } from 'bun';

// Simple ANSI colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const dim = '\x1b[2m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

// Host platform (used for defaults and for installing a local binary)
const hostPlatform = platform();
const hostArch = arch();

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
// Force temp/cache into repo-local .tmp to avoid permission issues on shared runners
const localTmp = join(repoRoot, '.tmp', 'tmp');
const localCache = join(repoRoot, '.tmp', 'cache');
const bunInstallCache = join(repoRoot, '.tmp', 'bun-install-cache');
const bunInstallRoot = join(repoRoot, '.tmp', 'bun');
mkdirSync(localTmp, { recursive: true });
mkdirSync(localCache, { recursive: true });
mkdirSync(bunInstallCache, { recursive: true });
mkdirSync(bunInstallRoot, { recursive: true });
process.env.TMPDIR = process.env.TMPDIR || localTmp;
process.env.XDG_CACHE_HOME = process.env.XDG_CACHE_HOME || localCache;
process.env.BUN_TMPDIR = process.env.BUN_TMPDIR || localTmp;
process.env.BUN_INSTALL_CACHE_DIR = process.env.BUN_INSTALL_CACHE_DIR || bunInstallCache;
process.env.BUN_INSTALL_CACHE = process.env.BUN_INSTALL_CACHE || bunInstallCache;
process.env.BUN_INSTALL = process.env.BUN_INSTALL || bunInstallRoot;
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

// Load OpenTUI solid plugin for JSX transformation
const solidPluginPath = resolve(repoRoot, 'node_modules/@opentui/solid/scripts/solid-plugin.ts');
const solidPlugin = (await import(solidPluginPath)).default;

// Ensure platform-specific deps are installed for all targets (mirrors opencode flow)
const coreVersion = mainPackage.dependencies?.['@opentui/core'];
if (coreVersion) {
  console.log(`${cyan}→${reset} Installing cross-platform @opentui/core (${coreVersion})`);
  await $`bun install --os="*" --cpu="*" --ignore-scripts --silent @opentui/core@${coreVersion}`;
}
const watcherVersion = mainPackage.dependencies?.['@parcel/watcher'];
if (watcherVersion) {
  console.log(`${cyan}→${reset} Installing cross-platform @parcel/watcher (${watcherVersion})`);
  await $`bun install --os="*" --cpu="*" --ignore-scripts --silent @parcel/watcher@${watcherVersion}`;
}

// Map platform/arch to target names
const platformMap = {
  'linux-x64': { target: 'bun-linux-x64', os: 'linux', arch: 'x64', ext: '' },
  'darwin-arm64': { target: 'bun-darwin-arm64', os: 'darwin', arch: 'arm64', ext: '' },
  'darwin-x64': { target: 'bun-darwin-x64', os: 'darwin', arch: 'x64', ext: '' },
  'win32-x64': { target: 'bun-windows-x64', os: 'windows', arch: 'x64', ext: '.exe' },
};

// Determine which targets to build
const args = process.argv.slice(2);
const argTargetIndex = args.findIndex((arg) => arg === '--target' || arg === '-t');
const flagAll = args.includes('--all') || process.env.TARGETS === 'all';
const requestedTargets =
  argTargetIndex !== -1 && args[argTargetIndex + 1]
    ? args[argTargetIndex + 1].split(',').map((t) => t.trim()).filter(Boolean)
    : process.env.TARGETS && process.env.TARGETS !== 'all'
      ? process.env.TARGETS.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

const defaultTarget = `${hostPlatform}-${hostArch}`;
const targetKeys = flagAll
  ? Object.keys(platformMap)
  : requestedTargets.length
    ? requestedTargets
    : [defaultTarget];

const targets = targetKeys.map((key) => {
  const cfg = platformMap[key];
  if (!cfg) {
    console.error(`${red}✗${reset} Unsupported target: ${bold}${key}${reset}`);
    console.error(`${dim}Supported:${reset} ${Object.keys(platformMap).join(', ')}`);
    process.exit(1);
  }
  return { key, ...cfg };
});

console.log(`\n${dim}Targets:${reset} ${bold}${targets.map((t) => t.key).join(', ')}${reset}\n`);

const outputRoot = process.env.OUTPUT_DIR || process.env.OUTPUT_ROOT || './binaries';

try {
  for (const targetConfig of targets) {
    const { target, os, arch: archName, ext = '', key } = targetConfig;
    const outdir = join(outputRoot, `codemachine-${os}-${archName}`);

    console.log(`${cyan}→${reset} Building executables for ${dim}${target}${reset}...`);
    mkdirSync(outdir, { recursive: true });

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
      codemachine: `codemachine${ext}`,
      'codemachine-workflow': `codemachine-workflow${ext}`,
      cm: `codemachine${ext}`,
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

    await Bun.write(join(outdir, 'package.json'), JSON.stringify(pkg, null, 2));

    // Only install the host platform binary locally for development ergonomics
    if (key === `${hostPlatform}-${hostArch}`) {
      const localPkgDir = join(repoRoot, 'node_modules', pkgName);
      rmSync(localPkgDir, { recursive: true, force: true });
      mkdirSync(join(repoRoot, 'node_modules'), { recursive: true });
      cpSync(outdir, localPkgDir, { recursive: true });
      console.log(`${dim}  • Installed host binary to${reset} ${localPkgDir}`);
    }

    console.log(`${green}✓${reset} ${bold}Built ${pkgName}${reset}`);
    console.log(`${dim}  • ${outdir}/codemachine${ext}${reset}`);
    console.log(`${dim}  • ${outdir}/codemachine-workflow${ext}${reset}\n`);
  }

  console.log(`\n${green}✓${reset} ${bold}Build complete for ${targets.length} target(s)${reset}\n`);
} catch (error) {
  console.error(`\n${red}✗${reset} ${bold}Build failed${reset}`);
  console.error(`${dim}${error.message}${reset}`);
  if (error.stack) {
    console.error(`\n${dim}${error.stack}${reset}`);
  }
  process.exit(1);
}
