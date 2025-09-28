import * as path from 'node:path';
import { readFile } from 'node:fs/promises';

const DEFAULT_PHASE_MAP = {
  Planning: { next: 'Building' },
  Building: { next: 'Testing' },
  Testing: { next: 'Runtime' },
  Runtime: { next: 'Completed' },
} as const;

export async function validateSpecification(specificationPath: string, force?: boolean): Promise<void> {
  const absolute = path.resolve(specificationPath);
  console.log(`Validating planning specification at ${absolute}`);

  if (force) return;

  let specificationContents: string;
  try {
    specificationContents = await readFile(absolute, { encoding: 'utf8' });
  } catch (error) {
    throw new Error(`Planning specification missing at "${absolute}".`, {
      cause: error instanceof Error ? error : undefined,
    });
  }

  if (specificationContents.trim().length === 0) {
    throw new Error(`Planning specification at "${absolute}" is empty. Provide a populated spec before continuing.`);
  }

  const nextPhase = DEFAULT_PHASE_MAP.Planning?.next ?? 'Building';
  console.log(`Advancing Planning workflow to next phase: ${nextPhase}`);
}
