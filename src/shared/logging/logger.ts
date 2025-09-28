import * as Pino from 'pino';

type DestinationStream = Pino.DestinationStream;
type LevelWithSilent = Pino.LevelWithSilent;
type PinoLogger = Pino.Logger;
type PinoLoggerOptions = Pino.LoggerOptions;

const { pino, transport } = Pino;

export interface LoggerOptions {
  level?: LevelWithSilent;
  name?: string;
  redact?: string[];
  destination?: DestinationStream | number;
}

export type Logger = PinoLogger;

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? (process.env.LOG_LEVEL as LevelWithSilent | undefined) ?? 'info';
  const defaultRedact = ['password', 'token', 'authorization', 'apiKey'];
  const redact = Array.from(new Set([...(options.redact ?? []), ...defaultRedact]));
  const base = { service: options.name ?? 'codemachine' };
  let prettyTransport: ReturnType<typeof transport> | undefined;
  let transportInitError: unknown;

  if (process.env.NODE_ENV !== 'production') {
    try {
      prettyTransport = transport({
        target: 'pino-pretty',
        options: { translateTime: 'SYS:standard', singleLine: false },
      });
    } catch (error) {
      transportInitError = error;
      prettyTransport = undefined;
    }
  }
  const destinationInput = options.destination;
  const destinationStream: DestinationStream | undefined =
    destinationInput === undefined
      ? undefined
      : typeof destinationInput === 'number'
        ? (Pino.destination(destinationInput) as unknown as DestinationStream)
        : destinationInput;

  const pinoOptions: PinoLoggerOptions = {
    level,
    redact,
    base,
    messageKey: 'message',
    hooks: {
      logMethod(args, method) {
        const errIndex = args.findIndex((arg) => arg instanceof Error);
        if (errIndex !== -1) {
          const error = args[errIndex] as Error;
          args[errIndex] = { ...error, stack: error.stack };
        }
        method.apply(this, args);
      },
    },
  };

  const logger = prettyTransport
    ? pino({ ...pinoOptions, transport: prettyTransport }, destinationStream)
    : pino(pinoOptions, destinationStream);

  if (transportInitError) {
    const warnContext =
      transportInitError instanceof Error
        ? { err: transportInitError }
        : { err: { message: String(transportInitError) } };
    logger.warn(warnContext, "Failed to initialize pretty logger transport; continuing without 'pino-pretty'.");
  }

  (logger as Logger & { withContext?: (context: Record<string, unknown>) => Logger }).withContext = (context) =>
    logger.child({ context });

  return logger;
}
