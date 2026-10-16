import { adminDb } from "@/db";
import { rateLimit } from "@/lib/rate-limit";

export type Throttle = { allowed: boolean; retryAfterSeconds: number };

/**
 * `limit` tries per `windowMs` per key, counted in Postgres so every server instance shares one count and a
 * redeploy doesn't reset it. If the database can't be reached it falls back to the in-memory limiter rather than
 * failing open or locking everyone out.
 */
export async function throttle(key: string, limit: number, windowMs: number): Promise<Throttle> {
  try {
    const rows = await adminDb().$queryRaw<{ count: number; seconds: number }[]>`
      insert into rate_limits (key, count, reset_at)
      values (${key}, 1, now() + (${windowMs}::int * interval '1 millisecond'))
      on conflict (key) do update set
        count = case when rate_limits.reset_at <= now() then 1 else rate_limits.count + 1 end,
        reset_at = case when rate_limits.reset_at <= now() then excluded.reset_at else rate_limits.reset_at end
      returning count, greatest(1, ceil(extract(epoch from (reset_at - now()))))::int as seconds`;
    const row = rows[0];
    if (!row) return rateLimit(key, limit, windowMs);
    return row.count > limit ? { allowed: false, retryAfterSeconds: row.seconds } : { allowed: true, retryAfterSeconds: 0 };
  } catch (e) {
    console.error("throttle: falling back to memory", e);
    return rateLimit(key, limit, windowMs);
  }
}

export async function clearThrottle(key: string): Promise<void> {
  try {
    await adminDb().$executeRaw`delete from rate_limits where key = ${key}`;
  } catch {
    /* best effort */
  }
}

/** Removes expired counters. Cheap enough to run opportunistically. */
export async function purgeThrottles(): Promise<void> {
  try {
    await adminDb().$executeRaw`delete from rate_limits where reset_at < now() - interval '1 day'`;
  } catch {
    /* best effort */
  }
}
