const DEFAULT_INTERVAL_MS = 12;

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
  intervalMs = DEFAULT_INTERVAL_MS,
  writer = defaultWriter,
  onChunk,
}: TypewriterOptions): Promise<void> => {
  if (!text) {
    return;
  }

  const delay = Math.max(0, intervalMs);
  for (let index = 0; index < text.length; index += 1) {
    const chunk = text[index] ?? '';
    writer(chunk);
    onChunk?.(chunk, index);

    const hasMore = index + 1 < text.length;
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
  const interval = Math.max(0, opts.intervalMs ?? DEFAULT_INTERVAL_MS);
  const onChunk = opts.onChunk ?? (() => {});
  const logger: LoggerFn =
    opts.logger ?? ((s: string) => {
      try {
        process.stdout.write(s);
      } catch {
        // ignore
      }
    });

  let index = 0;
  if (interval === 0) {
    while (index < text.length) {
      const ch = text[index++]!;
      try {
        onChunk(ch);
      } finally {
        logger(ch);
      }
    }

    return {
      stop() {
        // Nothing to cancel when interval is zero; streaming already completed.
      },
    };
  }

  const timer = setInterval(() => {
    if (index >= text.length) {
      clearInterval(timer);
      return;
    }

    const ch = text[index++]!;
    try {
      onChunk(ch);
    } finally {
      logger(ch);
    }
  }, interval);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}
