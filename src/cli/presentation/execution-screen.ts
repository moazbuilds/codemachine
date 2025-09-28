export type LoggerFn = (s: string) => void;

export interface RenderOptions {
  intervalMs?: number;
  onChunk?: (s: string) => void;
  logger?: LoggerFn;
}

interface StopHandle {
  stop(): void;
}

// Internal helper used under the hood
function renderTypewriter(
  text: string,
  intervalMs: number,
  onEmit: (chunk: string) => void
): StopHandle {
  let index = 0;
  const timer = setInterval(() => {
    if (index >= text.length) {
      clearInterval(timer);
      return;
    }
    const ch = text[index++]!;
    onEmit(ch);
  }, intervalMs);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}

/**
 * Renders execution output to the CLI with a typewriter effect.
 * Mirrors plain text to the provided logger and exposes a stop handle.
 */
export async function renderExecutionScreen(
  text: string,
  opts: RenderOptions = {}
): Promise<StopHandle> {
  const interval = typeof opts.intervalMs === 'number' ? opts.intervalMs : 12;
  const onChunk = opts.onChunk ?? (() => {});
  const logger: LoggerFn =
    opts.logger ?? ((s: string) => {
      try {
        process.stdout.write(s);
      } catch {
        // ignore
      }
    });

  const handle = renderTypewriter(text, interval, (chunk) => {
    try {
      onChunk(chunk);
    } finally {
      logger(chunk);
    }
  });

  return handle;
}

