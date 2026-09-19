import { describe, it, expect } from 'vitest'
import { redact } from '../lib/logger'

describe('logger redaction (never leak secrets to logs)', () => {
  it('redacts sensitive top-level keys', () => {
    const out = redact({ email: 'a@b.com', password: 'hunter2', token: 'abc', sessionSecret: 'x' }) as Record<string, unknown>
    expect(out.email).toBe('a@b.com')
    expect(out.password).toBe('[REDACTED]')
    expect(out.token).toBe('[REDACTED]')
    expect(out.sessionSecret).toBe('[REDACTED]')
  })
  it('redacts nested sensitive keys', () => {
    const out = redact({ user: { id: 1, passwordHash: 'zzz' }, headers: { cookie: 'sid=1' } }) as any
    expect(out.user.id).toBe(1)
    expect(out.user.passwordHash).toBe('[REDACTED]')
    expect(out.headers.cookie).toBe('[REDACTED]')
  })
  it('handles arrays and primitives without throwing', () => {
    expect(redact([{ apiKey: 'k' }, 'plain', 5])).toEqual([{ apiKey: '[REDACTED]' }, 'plain', 5])
    expect(redact(null)).toBe(null)
  })
})
