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

  // Allow disabling typewriter effect via environment variable
  const disableTypewriter = process.env.CODEMACHINE_NO_TYPEWRITER === '1';
  if (disableTypewriter) {
    writer(text);
    return;
  }

  const delay = Math.max(0, intervalMs);
  // Windows console is much slower at handling many small writes
  // Use larger batches on Windows for better performance
  const isWindows = process.platform === 'win32';
  const charsPerInterval = isWindows ? 200 : 5;

  for (let index = 0; index < text.length; index += charsPerInterval) {
    for (let i = 0; i < charsPerInterval && index + i < text.length; i += 1) {
      const chunk = text[index + i] ?? '';
      const chunkIndex = index + i;
      writer(chunk);
      onChunk?.(chunk, chunkIndex);
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

  // Allow disabling typewriter effect via environment variable
  const disableTypewriter = process.env.CODEMACHINE_NO_TYPEWRITER === '1';
  if (disableTypewriter) {
    logger(text);
    return {
      stop() {
        // Already completed
      },
    };
  }

  // Windows console is much slower at handling many small writes
  // Use larger batches on Windows for better performance
  const isWindows = process.platform === 'win32';
  const charsPerInterval = isWindows ? 200 : 5;
  let index = 0;

  if (interval <= 0) {
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
        // Nothing to cancel when interval is zero; streaming completed immediately.
      },
    };
  }

  const timer = setInterval(() => {
    if (index >= text.length) {
      clearInterval(timer);
      return;
    }

    for (let i = 0; i < charsPerInterval && index < text.length; i += 1) {
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
