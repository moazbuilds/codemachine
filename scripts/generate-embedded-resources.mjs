#!/usr/bin/env bun
import { mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const resourcesDir = join(repoRoot, 'src', 'shared', 'resources');
const targetPath = join(resourcesDir, 'embedded-resources.ts');
const packageJsonPath = join(repoRoot, 'package.json');

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

export async function generateEmbeddedResources(options = {}) {
  const include = options.include ?? DEFAULT_INCLUDE;
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

  const fileContents = `// AUTO-GENERATED FILE. DO NOT EDIT.
// Run scripts/generate-embedded-resources.mjs to regenerate.
import { Buffer } from 'node:buffer';

export const EMBEDDED_RESOURCES_VERSION = '${packageJson.version}';
export const EMBEDDED_RESOURCES_HASH = '${hash}';
export const EMBEDDED_RESOURCES_SIZE = ${compressed.length};

const EMBEDDED_BASE64 = ${JSON.stringify(base64)};

export function getEmbeddedResourceArchive(): Buffer {
  return Buffer.from(EMBEDDED_BASE64, 'base64');
}
`;

  mkdirSync(resourcesDir, { recursive: true });
  writeFileSync(targetPath, fileContents);

  if (!options.quiet) {
    console.log(`[embed] Embedded ${files.length} files (${payloadBuffer.length} bytes, compressed to ${compressed.length} bytes)`);
    console.log(`[embed] Hash: ${hash}`);
  }

  return { hash, size: compressed.length, fileCount: files.length };
}

if (import.meta.main) {
  generateEmbeddedResources().catch((error) => {
    console.error('[embed] Failed to generate embedded resources:', error);
    process.exitCode = 1;
  });
}
