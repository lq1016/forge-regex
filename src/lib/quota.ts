import { kv } from "@vercel/kv";

const FREE_DAILY_LIMIT = 5;

/**
 * Get remaining free usage for an IP.
 * Returns { used, remaining, limit }
 */
export async function getUsage(ipHash: string): Promise<{
  used: number;
  remaining: number;
  limit: number;
}> {
  const key = `usage:${ipHash}:${today()}`;
  const used = (await kv.get<number>(key)) ?? 0;
  return {
    used,
    remaining: Math.max(0, FREE_DAILY_LIMIT - used),
    limit: FREE_DAILY_LIMIT,
  };
}

/**
 * Increment usage counter atomically.
 * Returns the new count after increment.
 */
export async function incrementUsage(ipHash: string): Promise<number> {
  const key = `usage:${ipHash}:${today()}`;
  // Set TTL so keys auto-expire at end of day (86400s = 24h)
  const count = await kv.incr(key);
  if (count === 1) {
    await kv.expire(key, 86_400);
  }
  return count;
}

/**
 * Check if usage is allowed (under limit).
 */
export async function checkAndIncrement(
  ipHash: string
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const { remaining, limit } = await getUsage(ipHash);

  if (remaining <= 0) {
    return { allowed: false, remaining: 0, limit };
  }

  await incrementUsage(ipHash);
  return { allowed: true, remaining: remaining - 1, limit };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
