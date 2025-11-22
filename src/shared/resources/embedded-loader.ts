import { Buffer } from 'node:buffer';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { brotliDecompressSync } from 'node:zlib';

import { getEmbeddedResourceArchive, getEmbeddedResourceMetadata } from './embedded-resources.js';

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

type ArchiveMetadata = {
  version: string;
  hash: string;
  size: number;
  generatedAt?: string;
};

const FALLBACK_METADATA: ArchiveMetadata = {
  version: 'unknown',
  hash: 'unknown',
  size: 0,
};

let defaultMetadataCache: ArchiveMetadata | null = null;

function getDefaultMetadata(): ArchiveMetadata {
  if (defaultMetadataCache) {
    return defaultMetadataCache;
  }

  try {
    defaultMetadataCache = getEmbeddedResourceMetadata();
  } catch {
    defaultMetadataCache = FALLBACK_METADATA;
  }

  return defaultMetadataCache;
}

let activeMetadata: ArchiveMetadata = { ...getDefaultMetadata() };
let cachedPayload: EmbeddedPayload | null = null;
let cachedArchiveBuffer: Buffer | null = null;

function getArchiveCacheDir(): string {
  return join(getCacheBase(), 'embedded-resources');
}

function getArchiveCacheFile(): string {
  return join(getArchiveCacheDir(), 'embedded-resources.json');
}

function tryLoadArchiveFromCache(): Buffer | null {
  const cacheFile = getArchiveCacheFile();
  if (!existsSync(cacheFile)) {
    return null;
  }

  try {
    const data = JSON.parse(readFileSync(cacheFile, 'utf8')) as {
      version?: string;
      hash?: string;
      size?: number;
      base64?: string;
      generatedAt?: string;
    };
    if (!data?.base64) {
      return null;
    }
    const buffer = Buffer.from(data.base64, 'base64');
    const defaults = getDefaultMetadata();
    activeMetadata = {
      version: data.version ?? defaults.version,
      hash: data.hash ?? defaults.hash,
      size: data.size ?? buffer.length,
      generatedAt: data.generatedAt ?? defaults.generatedAt,
    };
    return buffer;
  } catch {
    return null;
  }
}

function getArchiveBuffer(): Buffer {
  if (cachedArchiveBuffer) {
    return cachedArchiveBuffer;
  }

  const cacheBuffer = tryLoadArchiveFromCache();
  if (cacheBuffer) {
    cachedArchiveBuffer = cacheBuffer;
    return cachedArchiveBuffer;
  }

  const fallback = getEmbeddedResourceArchive();
  if (!fallback || fallback.length === 0) {
    throw new Error('Embedded resource archive is empty');
  }

  // Ensure metadata reflects the currently loaded archive
  try {
    activeMetadata = getEmbeddedResourceMetadata();
  } catch {
    activeMetadata = { ...getDefaultMetadata(), size: fallback.length };
  }
  cachedArchiveBuffer = fallback;
  return cachedArchiveBuffer;
}

function decodeEmbeddedPayload(): EmbeddedPayload {
  if (cachedPayload) {
    return cachedPayload;
  }

  const archive = getArchiveBuffer();
  const decompressed = brotliDecompressSync(archive);
  cachedPayload = JSON.parse(decompressed.toString('utf8')) as EmbeddedPayload;
  if (cachedPayload.version && cachedPayload.version !== activeMetadata.version) {
    activeMetadata = { ...activeMetadata, version: cachedPayload.version };
  }
  if (cachedPayload.generatedAt && !activeMetadata.generatedAt) {
    activeMetadata = { ...activeMetadata, generatedAt: cachedPayload.generatedAt };
  }
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
  const metadata = { ...activeMetadata };
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

  writeFileSync(
    join(targetRoot, '.embedded.json'),
    JSON.stringify(
      {
        version: metadata.version ?? payload.version,
        hash: metadata.hash,
        size: metadata.size,
        generatedAt: payload.generatedAt,
      },
      null,
      2,
    ),
  );
}

export function ensureEmbeddedPackageRoot(): string | undefined {
  if (process.env.CODEMACHINE_DISABLE_EMBEDDED === '1') {
    return undefined;
  }

  try {
    getArchiveBuffer();
    const cacheBase = getCacheBase();
    const metadata = activeMetadata;
    const versionedDir = join(cacheBase, 'embedded-packages', `${metadata.version}-${metadata.hash}`);
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
