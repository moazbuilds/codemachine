import * as path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const DEFAULT_SPEC_TEMPLATE = `# Project Specifications

- Describe goals, constraints, and context.
- Link any relevant docs or tickets.
- This file is created by workspace bootstrap and can be safely edited.
`;

export async function validateSpecification(specificationPath: string, force?: boolean): Promise<void> {
  if (force) return;

  const absolute = path.resolve(specificationPath);
  let specificationContents: string;

  try {
    specificationContents = await readFile(absolute, { encoding: 'utf8' });
  } catch (error) {
    // File doesn't exist - create it with default template
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, DEFAULT_SPEC_TEMPLATE, { encoding: 'utf8' });
    throw new Error('Please write your spec file before starting');
  }

  const trimmed = specificationContents.trim();

  // Check if empty or still has default template content
  if (trimmed.length === 0 || trimmed === DEFAULT_SPEC_TEMPLATE.trim()) {
    throw new Error('Please write your spec file before starting');
  }
}
