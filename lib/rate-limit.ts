type Bucket = { count: number; resetAt: number };
const runtime = globalThis as typeof globalThis & { __tracepathRateLimit?: Map<string, Bucket> };
const buckets = runtime.__tracepathRateLimit ?? new Map<string, Bucket>();
runtime.__tracepathRateLimit = buckets;

export function takeAnalysisSlot(identity: string, now = Date.now()) {
  const current = buckets.get(identity);
  if (!current || current.resetAt <= now) {
    buckets.set(identity, { count: 1, resetAt: now + 60_000 });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= 5) return { allowed: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}
