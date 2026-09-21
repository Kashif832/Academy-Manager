import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createRedisStore, type RateLimitStore } from '../../lib/rate-limit'

// Two-instance distributed rate-limit verification. Requires a real Redis
// (REDIS_URL). Skips (does not fail) when none is configured — locally there is
// no Redis; CI provides a Redis service so this actually runs there.
const REDIS_URL = process.env.REDIS_URL
const run = REDIS_URL ? describe : describe.skip

run('distributed rate limiting across two instances (real Redis)', () => {
  let instanceA: RateLimitStore
  let instanceB: RateLimitStore
  const key = 'e2e:redis:' + Date.now()

  beforeAll(() => {
    // Two independent stores against the SAME Redis = two app instances.
    instanceA = createRedisStore(REDIS_URL as string)
    instanceB = createRedisStore(REDIS_URL as string)
  })
  afterAll(async () => {
    // @ts-expect-error internal client cleanup for the test
    await instanceA?.['client']?.quit?.().catch?.(() => {})
    // @ts-expect-error internal client cleanup for the test
    await instanceB?.['client']?.quit?.().catch?.(() => {})
  })

  it('enforces a shared limit across both instances', async () => {
    // Limit 4/min. Alternate instances; the 5th call (whichever instance) blocks.
    expect((await instanceA.hit(key, 4, 60_000)).ok).toBe(true) // 1
    expect((await instanceB.hit(key, 4, 60_000)).ok).toBe(true) // 2
    expect((await instanceA.hit(key, 4, 60_000)).ok).toBe(true) // 3
    expect((await instanceB.hit(key, 4, 60_000)).ok).toBe(true) // 4
    const blocked = await instanceA.hit(key, 4, 60_000) // 5 -> blocked
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })
})
