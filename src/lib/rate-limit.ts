/**
 * Small in-memory limiter for login attempts: `limit` tries per `windowMs` per key.
 * In-memory means it resets on restart and is per server instance; swap for Redis when you run several
 * instances. It still blunts casual password guessing.
 */
type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  if (store.size > 5000) {
    for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
  }
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  entry.count += 1;
  if (entry.count > limit) return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetRateLimit(key: string) {
  store.delete(key);
}
