/**
 * Engine abstraction types for Codex and Claude
 */

/**
 * Engine type - now dynamically determined from registry
 * Use registry.getAllIds() to get available engine IDs at runtime
 */
export type EngineType = string;

export interface EngineRunOptions {
  prompt: string;
  workingDir: string;
  model?: string;
  modelReasoningEffort?: 'low' | 'medium' | 'high';
  env?: NodeJS.ProcessEnv;
  onData?: (chunk: string) => void;
  onErrorData?: (chunk: string) => void;
  abortSignal?: AbortSignal;
  timeout?: number;
}

export interface EngineRunResult {
  stdout: string;
  stderr: string;
}

export interface Engine {
  type: EngineType;
  run(options: EngineRunOptions): Promise<EngineRunResult>;
}

/**
 * Validate if a string is a valid engine type
 * Must be imported after registry is initialized
 */
export function isValidEngineType(type: string): boolean {
  // Lazy import to avoid circular dependency
  // Will be validated by registry at runtime
  return typeof type === 'string' && type.length > 0;
}
