/**
 * Logger utility that respects LOG_LEVEL environment variable
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

function getCurrentLogLevel(): LogLevel {
  const level = (process.env.LOG_LEVEL || 'info').trim().toLowerCase() as LogLevel;
  const resolved = LOG_LEVELS[level] !== undefined ? level : 'info';

  // Debug: log the environment variable value on first call
  if (!globalThis.__logLevelInitialized) {
    globalThis.__logLevelInitialized = true;
    console.error(`[LOGGER INIT] LOG_LEVEL="${process.env.LOG_LEVEL}", trimmed="${level}", resolved to: ${resolved}`);
  }

  return resolved;
}

function shouldLog(level: LogLevel): boolean {
  const currentLevel = getCurrentLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

export function debug(message: string, ...args: any[]): void {
  if (shouldLog('debug')) {
    console.error(`[DEBUG] ${message}`, ...args);
  }
}

export function info(message: string, ...args: any[]): void {
  if (shouldLog('info')) {
    console.error(`[INFO] ${message}`, ...args);
  }
}

export function warn(message: string, ...args: any[]): void {
  if (shouldLog('warn')) {
    console.error(`[WARN] ${message}`, ...args);
  }
}

export function error(message: string, ...args: any[]): void {
  if (shouldLog('error')) {
    console.error(`[ERROR] ${message}`, ...args);
  }
}
