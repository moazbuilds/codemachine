export interface OpenCodeConfig {
  /**
   * Optional OpenCode model identifier (provider/model)
   */
  model?: string;
  /**
   * Optional agent name to run (defaults to 'build')
   */
  agent?: string;
  /**
   * Optional configuration directory override
   */
  configDir?: string;
}

/**
 * Resolve an OpenCode model name.
 * Currently pass-through to keep the hook for future mapping logic.
 */
export function resolveModel(model?: string): string | undefined {
  const trimmed = model?.trim();
  return trimmed ? trimmed : undefined;
}
