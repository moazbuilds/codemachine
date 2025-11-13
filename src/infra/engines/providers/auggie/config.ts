export interface AuggieConfig {
  /**
   * Optional Auggie model identifier
   */
  model?: string;
  /**
   * Optional configuration directory override
   */
  configDir?: string;
}

/**
 * Resolve an Auggie model name.
 * Currently pass-through to keep the hook for future mapping logic.
 */
export function resolveModel(model?: string): string | undefined {
  const trimmed = model?.trim();
  return trimmed ? trimmed : undefined;
}

