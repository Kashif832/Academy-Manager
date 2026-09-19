import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { rateLimit, __resetRateLimiter, __setRateLimitStore, type RateLimitStore } from '../lib/rate-limit'

beforeEach(() => __resetRateLimiter())
afterEach(() => __setRateLimitStore(null)) // restore default in-memory store

describe('rateLimit (default in-process store)', () => {
  it('allows up to the limit then blocks', async () => {
    const key = 'test:a'
    for (let i = 0; i < 5; i++) expect((await rateLimit(key, 5, 60_000)).ok).toBe(true)
    const blocked = await rateLimit(key, 5, 60_000)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })
  it('keeps separate counters per key', async () => {
    expect((await rateLimit('test:x', 1, 60_000)).ok).toBe(true)
    expect((await rateLimit('test:x', 1, 60_000)).ok).toBe(false)
    expect((await rateLimit('test:y', 1, 60_000)).ok).toBe(true)
  })
  it('resets after the window elapses', async () => {
    expect((await rateLimit('test:z', 1, 20)).ok).toBe(true)
    expect((await rateLimit('test:z', 1, 20)).ok).toBe(false)
    await new Promise((r) => setTimeout(r, 30))
    expect((await rateLimit('test:z', 1, 20)).ok).toBe(true)
  })
})

describe('rateLimit fail-safe (shared-store outage must NOT bypass limits)', () => {
  // A store that always throws simulates a Redis outage.
  const brokenStore: RateLimitStore = {
    hit: async () => {
      throw new Error('redis down')
    },
    reset: () => {},
  }

  it('still enforces a limit via the in-process fallback when the shared store errors', async () => {
    __setRateLimitStore(brokenStore)
    const key = 'outage:ip:1.2.3.4'
    // Despite the primary store throwing on every call, the fallback still
    // counts — so brute force is NOT unlocked (would be a security bypass).
    for (let i = 0; i < 3; i++) expect((await rateLimit(key, 3, 60_000)).ok).toBe(true)
    const blocked = await rateLimit(key, 3, 60_000)
    expect(blocked.ok).toBe(false)
  })

  it('never returns ok:true unboundedly during an outage', async () => {
    __setRateLimitStore(brokenStore)
    let allowed = 0
    for (let i = 0; i < 50; i++) if ((await rateLimit('outage:burst', 5, 60_000)).ok) allowed++
    expect(allowed).toBe(5) // exactly the limit, never all 50
  })
})
