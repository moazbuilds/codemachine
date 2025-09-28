export interface TypewriterOptions {
  text: string;
  intervalMs?: number;
  writer?: (chunk: string) => unknown;
  onChunk?: (chunk: string, index: number) => void;
}

const defaultWriter = (chunk: string) => {
  process.stdout.write(chunk);
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const renderTypewriter = async ({
  text,
  intervalMs = 12,
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

    const hasMore = index < text.length - 1;
    if (hasMore && delay > 0) {
      await sleep(delay);
    }
  }
};
