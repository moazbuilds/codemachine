#!/usr/bin/env bun
import { mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const resourcesDir = join(repoRoot, 'src', 'shared', 'resources');
const targetJsonPath = join(resourcesDir, 'embedded-resources.json');
const packageJsonPath = join(repoRoot, 'package.json');
const cacheDirName = 'embedded-resources';

const DEFAULT_INCLUDE = ['package.json', 'config', 'prompts', 'templates'];

function collectFiles(root, entry, result) {
  const absolute = join(root, entry);
  const stats = statSync(absolute, { throwIfNoEntry: true });

  if (stats.isDirectory()) {
    for (const child of readdirSync(absolute)) {
      collectFiles(root, join(entry, child), result);
    }
    return;
  }

  if (!stats.isFile()) return;

  const rel = entry.replace(/\\/g, '/');
  const content = readFileSync(absolute);
  result.push({
    path: rel,
    mode: stats.mode & 0o777,
    content: content.toString('base64'),
  });
}

function getCacheBase() {
  if (process.env.CODEMACHINE_EMBEDDED_CACHE) {
    return process.env.CODEMACHINE_EMBEDDED_CACHE;
  }
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
    return join(base, 'CodeMachine', 'Cache');
  }
  const xdgCache = process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache');
  return join(xdgCache, 'codemachine');
}

export async function generateEmbeddedResources(options = {}) {
  const include = options.include ?? DEFAULT_INCLUDE;
  let shouldWriteJson = options.writeJson;
  if (shouldWriteJson === undefined && options.writeStub === true) {
    // Backwards compatibility for callers that previously passed writeStub
    shouldWriteJson = true;
  }
  if (typeof shouldWriteJson !== 'boolean') {
    shouldWriteJson = true;
  }
  const shouldWriteCache = options.writeCache ?? true;
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const files = [];

  for (const entry of include) {
    const absolute = join(repoRoot, entry);
    try {
      const stats = statSync(absolute);
      if (stats.isDirectory()) {
        for (const child of readdirSync(absolute)) {
          collectFiles(repoRoot, join(entry, child), files);
        }
      } else if (stats.isFile()) {
        collectFiles(repoRoot, entry, files);
      }
    } catch {
      // Skip missing entries
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path));

  const payload = {
    version: packageJson.version,
    generatedAt: new Date().toISOString(),
    files,
  };

  const payloadBuffer = Buffer.from(JSON.stringify(payload));
  const compressed = brotliCompressSync(payloadBuffer);
  const base64 = compressed.toString('base64');
  const hash = createHash('sha256').update(compressed).digest('hex');

  const archiveRecord = {
    version: packageJson.version,
    generatedAt: payload.generatedAt,
    hash,
    size: compressed.length,
    base64,
  };

  const writeCache = () => {
    let cacheBase = getCacheBase();
    let cacheDir = join(cacheBase, cacheDirName);
    let cacheFile = join(cacheDir, 'embedded-resources.json');

    try {
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(cacheFile, JSON.stringify(archiveRecord, null, 2));
      return { cacheFile };
    } catch (error) {
      // Fall back to a temp cache if the primary location is not writable
      if (error?.code === 'EACCES' || error?.code === 'EPERM') {
        cacheBase = join(tmpdir(), 'codemachine-cache');
        cacheDir = join(cacheBase, cacheDirName);
        cacheFile = join(cacheDir, 'embedded-resources.json');
        mkdirSync(cacheDir, { recursive: true });
        writeFileSync(cacheFile, JSON.stringify(archiveRecord, null, 2));
        return { cacheFile };
      }
      throw error;
    }
  };

  const cacheResult = shouldWriteCache ? writeCache() : {};

  if (shouldWriteJson) {
    mkdirSync(resourcesDir, { recursive: true });
    writeFileSync(targetJsonPath, JSON.stringify(archiveRecord, null, 2));
  }

  if (!options.quiet) {
    console.log(`[embed] Embedded ${files.length} files (${payloadBuffer.length} bytes, compressed to ${compressed.length} bytes)`);
    console.log(`[embed] Hash: ${hash}`);
    if (cacheResult.cacheFile) {
      console.log(`[embed] Cache file written to ${cacheResult.cacheFile}`);
    }
    if (shouldWriteJson) {
      console.log(`[embed] JSON archive written to ${targetJsonPath}`);
    } else {
      console.log('[embed] Skipped writing src/shared/resources/embedded-resources.json');
    }
  }

  return {
    hash,
    size: compressed.length,
    fileCount: files.length,
    cacheFile: cacheResult.cacheFile,
    jsonFile: shouldWriteJson ? targetJsonPath : undefined,
  };
}

if (import.meta.main) {
  const args = new Set(process.argv.slice(2));
  const cacheOnly = args.has('--cache-only');
  const writeJson = args.has('--no-json') ? false : args.has('--write-json') ? true : !cacheOnly;
  const writeCache = args.has('--no-cache') ? false : true;
  generateEmbeddedResources({ writeJson, writeCache }).catch((error) => {
    console.error('[embed] Failed to generate embedded resources:', error);
    process.exitCode = 1;
  });
}
