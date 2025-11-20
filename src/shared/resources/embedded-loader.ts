import { Buffer } from 'node:buffer';
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { brotliDecompressSync } from 'node:zlib';

import {
  EMBEDDED_RESOURCES_HASH,
  EMBEDDED_RESOURCES_SIZE,
  EMBEDDED_RESOURCES_VERSION,
  getEmbeddedResourceArchive
} from './embedded-resources.js';

type EmbeddedFile = {
  path: string;
  content: string;
  mode?: number;
};

type EmbeddedPayload = {
  version: string;
  generatedAt?: string;
  files: EmbeddedFile[];
};

let cachedPayload: EmbeddedPayload | null = null;

function decodeEmbeddedPayload(): EmbeddedPayload {
  if (cachedPayload) {
    return cachedPayload;
  }

  const archive = getEmbeddedResourceArchive();
  if (!archive || archive.length === 0) {
    throw new Error('Embedded resource archive is empty');
  }

  const decompressed = brotliDecompressSync(archive);
  cachedPayload = JSON.parse(decompressed.toString('utf8')) as EmbeddedPayload;
  return cachedPayload;
}

function getCacheBase(): string {
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

function writeEmbeddedResources(targetRoot: string): void {
  const payload = decodeEmbeddedPayload();
  rmSync(targetRoot, { recursive: true, force: true });
  mkdirSync(targetRoot, { recursive: true });

  for (const file of payload.files) {
    const destination = join(targetRoot, file.path);
    mkdirSync(dirname(destination), { recursive: true });
    const buffer = Buffer.from(file.content, 'base64');
    writeFileSync(destination, buffer, { mode: file.mode });
    if (typeof file.mode === 'number') {
      chmodSync(destination, file.mode);
    }
  }

  const metadata = {
    version: payload.version,
    hash: EMBEDDED_RESOURCES_HASH,
    size: EMBEDDED_RESOURCES_SIZE,
    generatedAt: payload.generatedAt,
  };
  writeFileSync(join(targetRoot, '.embedded.json'), JSON.stringify(metadata, null, 2));
}

export function ensureEmbeddedPackageRoot(): string | undefined {
  if (process.env.CODEMACHINE_DISABLE_EMBEDDED === '1') {
    return undefined;
  }

  try {
    const cacheBase = getCacheBase();
    const versionedDir = join(cacheBase, 'embedded-packages', `${EMBEDDED_RESOURCES_VERSION}-${EMBEDDED_RESOURCES_HASH}`);
    const marker = join(versionedDir, '.embedded.json');

    if (!existsSync(marker)) {
      writeEmbeddedResources(versionedDir);
    }

    const pkgJsonPath = join(versionedDir, 'package.json');
    if (!existsSync(pkgJsonPath)) {
      writeEmbeddedResources(versionedDir);
    }

    process.env.CODEMACHINE_PACKAGE_ROOT ??= versionedDir;
    process.env.CODEMACHINE_INSTALL_DIR ??= versionedDir;
    process.env.CODEMACHINE_PACKAGE_JSON ??= pkgJsonPath;

    return versionedDir;
  } catch (error) {
    // Fall back to a temporary directory if cache write fails
    try {
      const fallbackDir = join(tmpdir(), `codemachine-embedded-${process.pid}`);
      writeEmbeddedResources(fallbackDir);
      const pkgJsonPath = join(fallbackDir, 'package.json');
      process.env.CODEMACHINE_PACKAGE_ROOT = fallbackDir;
      process.env.CODEMACHINE_INSTALL_DIR = fallbackDir;
      process.env.CODEMACHINE_PACKAGE_JSON = pkgJsonPath;
      return fallbackDir;
    } catch {
      if (process.env.CODEMACHINE_DEBUG_BOOTSTRAP === '1') {
        console.error('[workspace-bootstrap] Failed to extract embedded resources', error);
      }
      return undefined;
    }
  }
}
