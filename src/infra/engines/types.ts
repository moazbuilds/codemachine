/**
 * Engine abstraction types for Codex and Claude
 */

export type EngineType = 'codex' | 'claude';

export interface EngineRunOptions {
  profile: string;
  prompt: string;
  workingDir: string;
  model?: string;
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
