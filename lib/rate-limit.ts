import type { NextRequest } from 'next/server'
import { createHash } from 'crypto'

// Hash an identifier (e.g. an email) before it becomes part of a rate-limit
// key, so raw credentials / PII are never written to the shared store.
export function safeKeyPart(value: string): string {
  return createHash('sha256').update(value.toLowerCase()).digest('hex').slice(0, 24)
}

// Rate limiter with a pluggable, production-grade shared backing store.
//
// - Default: an in-process fixed-window store (zero dependencies, correct for a
//   single instance).
// - Production / horizontally scaled: set REDIS_URL and a Redis-backed store is
//   used automatically, so limits are enforced across every app instance.
//
// The call-site API is unchanged in shape (namespaced key + limit + window); it
// is now async because a shared store is an I/O call.
//
// FAIL-SAFE: if the shared store errors (a Redis outage), we DO NOT fail open —
// that would turn a rate-limit outage into an authentication-brute-force
// bypass. Instead we fall back to the in-process limiter for that call, so a
// per-instance limit is always enforced. See tests/rate-limit.test.ts.

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number }

export interface RateLimitStore {
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>
  reset(): void
}

// ─── In-process fixed-window store (default + fail-safe fallback) ────────────
class InMemoryStore implements RateLimitStore {
  private buckets = new Map<string, { count: number; resetAt: number }>()
  private lastSweep = 0

  private sweep(now: number) {
    if (now - this.lastSweep < 60_000) return
    this.lastSweep = now
    for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k)
  }

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now()
    this.sweep(now)
    const b = this.buckets.get(key)
    if (!b || b.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs })
      return { ok: true }
    }
    if (b.count >= limit) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) }
    b.count += 1
    return { ok: true }
  }

  reset() {
    this.buckets.clear()
    this.lastSweep = 0
  }
}

// ─── Redis-backed shared store (used when REDIS_URL is set) ──────────────────
// Atomic fixed-window via INCR + PEXPIRE (a one-shot Lua script keeps the two
// operations atomic). ioredis is lazy-required so the dependency is only loaded
// when Redis is actually configured.
class RedisStore implements RateLimitStore {
  private client: unknown
  private static SCRIPT = `
    local c = redis.call('INCR', KEYS[1])
    if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
    local ttl = redis.call('PTTL', KEYS[1])
    return {c, ttl}`

  constructor(url: string) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require('ioredis')
    this.client = new Redis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: false, lazyConnect: false })
  }

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await (this.client as any).eval(RedisStore.SCRIPT, 1, `rl:${key}`, windowMs)) as [number, number]
    const [count, ttl] = res
    if (count > limit) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((ttl > 0 ? ttl : windowMs) / 1000)) }
    return { ok: true }
  }

  reset() {
    /* no-op: shared store is not reset from a single instance */
  }
}

// ─── Store selection + fail-safe wrapper ─────────────────────────────────────
let primary: RateLimitStore = process.env.REDIS_URL ? new RedisStore(process.env.REDIS_URL) : new InMemoryStore()
const fallback = new InMemoryStore()

// Test seam: swap the primary store (e.g. a store that throws, to prove the
// fail-safe fallback still enforces a limit and never bypasses auth).
export function __setRateLimitStore(store: RateLimitStore | null) {
  primary = store ?? new InMemoryStore()
}

export function clientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

// Returns ok:false once `limit` requests for the same key occur inside
// `windowMs`. `key` should already namespace the action (e.g. `login:1.2.3.4`).
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  try {
    return await primary.hit(key, limit, windowMs)
  } catch {
    // Shared store unavailable → degrade to the in-process limiter rather than
    // failing open. A limit is still enforced; brute force is not unlocked.
    return fallback.hit(key, limit, windowMs)
  }
}

// Test/maintenance helper.
export function __resetRateLimiter() {
  primary.reset()
  fallback.reset()
}
