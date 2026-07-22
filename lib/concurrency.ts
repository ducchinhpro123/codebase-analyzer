/**
 * Map items with a bounded number of in-flight tasks while preserving order.
 *
 * A small worker pool keeps provider pressure predictable while allowing
 * independent work, such as per-module LLM summaries, to run concurrently.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  requestedConcurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (!items.length) return [];

  const concurrency = Math.min(items.length, Math.max(1, Math.floor(requestedConcurrency) || 1));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}
