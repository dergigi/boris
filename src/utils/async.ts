/**
 * Wrap a promise with a timeout
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs = 30000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ])
}

/**
 * Map items through an async function with limited concurrency
 * @param items - Array of items to process
 * @param limit - Maximum number of concurrent operations
 * @param mapper - Async function to apply to each item
 * @returns Array of results in the same order as input
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let currentIndex = 0

  const worker = async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++
      results[index] = await mapper(items[index], index)
    }
  }

  const workers = new Array(Math.min(limit, items.length)).fill(0).map(() => worker())
  await Promise.all(workers)
  return results
}

