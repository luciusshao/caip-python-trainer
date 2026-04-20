import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiter with graceful fallback.
 *
 * Priority order:
 *   1. Upstash Redis  — if UPSTASH_REDIS_REST_URL / TOKEN are set
 *   2. In-memory Map  — dev fallback, single-process only (resets on reload)
 *
 * Limits:
 *   - chat:   20 requests / 60 seconds per userId
 *   - auth:   10 requests / 60 seconds per IP (register/forgot-password)
 */

const useRedis = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

let chatLimiter: Ratelimit | null = null;
let authLimiter: Ratelimit | null = null;

if (useRedis) {
  const redis = Redis.fromEnv();
  chatLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "60 s"),
    prefix: "rl:chat",
  });
  authLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "60 s"),
    prefix: "rl:auth",
  });
}

// ── In-memory fallback ────────────────────────────────

interface Bucket {
  count: number;
  resetAt: number;
}

const memory = new Map<string, Bucket>();

function memoryLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const bucket = memory.get(key);
  if (!bucket || bucket.resetAt < now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: max - 1 };
  }
  if (bucket.count >= max) {
    return { success: false, remaining: 0 };
  }
  bucket.count++;
  return { success: true, remaining: max - bucket.count };
}

// ── Public API ───────────────────────────────────────

export async function limitChat(identifier: string) {
  if (chatLimiter) {
    const r = await chatLimiter.limit(identifier);
    return { success: r.success, remaining: r.remaining };
  }
  return memoryLimit(`chat:${identifier}`, 20, 60_000);
}

export async function limitAuth(identifier: string) {
  if (authLimiter) {
    const r = await authLimiter.limit(identifier);
    return { success: r.success, remaining: r.remaining };
  }
  return memoryLimit(`auth:${identifier}`, 10, 60_000);
}
