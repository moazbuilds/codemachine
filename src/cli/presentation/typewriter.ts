export interface TypewriterOptions {
  text: string;
  intervalMs?: number;
  writer?: (chunk: string) => unknown;
  onChunk?: (chunk: string, index: number) => void;
}

export interface RenderOptions {
  intervalMs?: number;
  onChunk?: (s: string) => void;
  logger?: LoggerFn;
}

export type LoggerFn = (s: string) => void;

export interface StopHandle {
  stop(): void;
}

const defaultWriter = (chunk: string) => {
  process.stdout.write(chunk);
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Renders text with a typewriter effect using async/await.
 * Cannot be stopped mid-execution.
 */
export const renderTypewriter = async ({
  text,
  intervalMs = 1,
  writer = defaultWriter,
  onChunk,
}: TypewriterOptions): Promise<void> => {
  if (!text) {
    return;
  }

  const delay = Math.max(0, intervalMs);
  const charsPerInterval = 5; // Write 5 chars every 1ms = 5x faster

  for (let index = 0; index < text.length; index += charsPerInterval) {
    // Write multiple characters at once
    for (let i = 0; i < charsPerInterval && index + i < text.length; i++) {
      const chunk = text[index + i] ?? '';
      writer(chunk);
      onChunk?.(chunk, index + i);
    }

    const hasMore = index + charsPerInterval < text.length;

    if (hasMore && delay > 0) {
      await sleep(delay);
    }
  }
};

/**
 * Renders text with a typewriter effect using setInterval.
 * Returns a handle with stop() method to cancel mid-execution.
 */
export function renderExecutionScreen(
  text: string,
  opts: RenderOptions = {}
): StopHandle {
  const interval = typeof opts.intervalMs === 'number' ? opts.intervalMs : 1;
  const onChunk = opts.onChunk ?? (() => {});
  const logger: LoggerFn =
    opts.logger ?? ((s: string) => {
      try {
        process.stdout.write(s);
      } catch {
        // ignore
      }
    });

  const charsPerInterval = 5; // Write 5 chars every 1ms = 5x faster
  let index = 0;

  const timer = setInterval(() => {
    if (index >= text.length) {
      clearInterval(timer);
      return;
    }

    // Write multiple characters per interval
    for (let i = 0; i < charsPerInterval && index < text.length; i++) {
      const ch = text[index++]!;
      try {
        onChunk(ch);
      } finally {
        logger(ch);
      }
    }
  }, interval);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}
