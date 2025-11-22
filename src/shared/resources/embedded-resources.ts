import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';

export type EmbeddedArchiveMetadata = {
  version: string;
  hash: string;
  size: number;
  generatedAt?: string;
};

type ArchiveSource = {
  base64: string;
  version?: string;
  hash?: string;
  size?: number;
  generatedAt?: string;
};

const require = createRequire(import.meta.url);
const moduleDir = dirname(fileURLToPath(import.meta.url));
const packagedJsonPath = join(moduleDir, 'embedded-resources.json');

let cachedSource: ArchiveSource | null = null;
let cachedBuffer: Buffer | null = null;
let cachedMetadata: EmbeddedArchiveMetadata | null = null;

function normalizeArchiveSource(data: Partial<ArchiveSource> | undefined): ArchiveSource | null {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.base64 !== 'string' || data.base64.length === 0) return null;

  return {
    base64: data.base64,
    version: data.version,
    hash: data.hash,
    size: data.size,
    generatedAt: data.generatedAt,
  };
}

function tryLoadEnv(): ArchiveSource | null {
  const direct = process.env.CODEMACHINE_EMBEDDED_ARCHIVE;
  if (direct) {
    return { base64: direct };
  }

  const filePath = process.env.CODEMACHINE_EMBEDDED_ARCHIVE_FILE;
  if (filePath && existsSync(filePath)) {
    try {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = normalizeArchiveSource(JSON.parse(raw));
      if (parsed) return parsed;

      const trimmed = raw.trim();
      if (trimmed.length > 0) {
        return { base64: trimmed };
      }
    } catch {
      // Ignore malformed env file; fall through to other sources
    }
  }

  return null;
}

function tryLoadPackagedJson(): ArchiveSource | null {
  // Prefer bundler-friendly require to allow Bun/TS to inline the data when present
  try {
    const required = normalizeArchiveSource(require('./embedded-resources.json'));
    if (required) return required;
  } catch {
    // Ignore missing/invalid packaged JSON
  }

  // Fallback to reading from disk (useful in dev when running from source)
  try {
    if (existsSync(packagedJsonPath)) {
      const raw = readFileSync(packagedJsonPath, 'utf8');
      const parsed = normalizeArchiveSource(JSON.parse(raw));
      if (parsed) return parsed;
    }
  } catch {
    // Ignore failures and fall through
  }

  return null;
}

function loadArchiveSource(): ArchiveSource {
  if (cachedSource) {
    return cachedSource;
  }

  const envSource = tryLoadEnv();
  if (envSource) {
    cachedSource = envSource;
    return envSource;
  }

  const packaged = tryLoadPackagedJson();
  if (packaged) {
    cachedSource = packaged;
    return packaged;
  }

  throw new Error(
    'Embedded resources are not available. Provide CODEMACHINE_EMBEDDED_ARCHIVE(_FILE) or generate src/shared/resources/embedded-resources.json.',
  );
}

function computeMetadata(base64: string, hints?: Partial<ArchiveSource>): EmbeddedArchiveMetadata {
  const buffer = Buffer.from(base64, 'base64');
  let version = hints?.version;
  let generatedAt = hints?.generatedAt;

  // Derive version/generatedAt from the payload when not provided
  if (!version || !generatedAt) {
    try {
      const payload = JSON.parse(brotliDecompressSync(buffer).toString('utf8')) as {
        version?: string;
        generatedAt?: string;
      };
      version ??= payload.version;
      generatedAt ??= payload.generatedAt;
    } catch {
      // Ignore payload parsing issues; fall back to defaults below
    }
  }

  const size = hints?.size ?? buffer.length;
  const hash = hints?.hash ?? createHash('sha256').update(buffer).digest('hex');

  return {
    version: version ?? 'unknown',
    hash,
    size,
    generatedAt,
  };
}

export function getEmbeddedResourceArchive(): Buffer {
  if (!cachedBuffer) {
    const source = loadArchiveSource();
    cachedBuffer = Buffer.from(source.base64, 'base64');
    cachedMetadata = computeMetadata(source.base64, source);
  }
  return cachedBuffer;
}

export function getEmbeddedResourceMetadata(): EmbeddedArchiveMetadata {
  if (!cachedMetadata) {
    const source = loadArchiveSource();
    cachedMetadata = computeMetadata(source.base64, source);
    cachedBuffer ??= Buffer.from(source.base64, 'base64');
  }
  return cachedMetadata;
}
