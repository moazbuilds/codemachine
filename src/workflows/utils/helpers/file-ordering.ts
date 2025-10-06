export function extractOrderPrefix(filename: string): number | null {
  const match = filename.match(/^(\d+)\s*-/);
  return match ? parseInt(match[1], 10) : null;
}
