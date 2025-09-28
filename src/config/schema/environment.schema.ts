import { z } from 'zod';

const nodeEnvValues = ['development', 'test', 'production'] as const;
const codemachineModes = ['build', 'template'] as const;
const logLevels = ['debug', 'info', 'warn', 'error'] as const;

export const environmentSchema = z.object({
  NODE_ENV: z.enum(nodeEnvValues).default('development'),
  CODEX_HOME: z
    .string()
    .trim()
    .min(1, 'CODEX_HOME must point to the Codex workspace root directory.'),
  CODEMACHINE_MODE: z.enum(codemachineModes).default('build'),
  LOG_LEVEL: z.enum(logLevels).default('info'),
  TELEMETRY_ENABLED: z.coerce.boolean().default(false),
});

export type EnvironmentConfig = z.infer<typeof environmentSchema>;
