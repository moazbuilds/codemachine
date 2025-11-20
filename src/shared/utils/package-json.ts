import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolvePackageJson(moduleUrl: string, errorContext: string): string {
  const explicitPath = process.env.CODEMACHINE_PACKAGE_JSON;
  if (explicitPath && existsSync(explicitPath)) {
    return explicitPath;
  }

  const root = resolvePackageRoot(moduleUrl, errorContext);
  const rootCandidate = join(root, 'package.json');
  if (existsSync(rootCandidate)) {
    return rootCandidate;
  }

  throw new Error(`Unable to locate package.json from ${errorContext}`);
}

export function resolvePackageRoot(moduleUrl: string, errorContext: string): string {
  const explicitRoot = process.env.CODEMACHINE_PACKAGE_ROOT;
  if (explicitRoot && existsSync(join(explicitRoot, 'package.json'))) {
    return explicitRoot;
  }

  let currentDir = dirname(fileURLToPath(moduleUrl));
  const { root } = parse(currentDir);

  while (true) {
    if (existsSync(join(currentDir, 'package.json'))) {
      return currentDir;
    }
    if (currentDir === root) {
      break;
    }
    currentDir = dirname(currentDir);
  }

  throw new Error(`Unable to locate package root from ${errorContext}`);
}
