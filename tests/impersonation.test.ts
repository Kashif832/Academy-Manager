import { describe, it, expect } from 'vitest'
import { isImpersonationSessionLive } from '../lib/super-session'

const future = new Date(Date.now() + 60 * 60 * 1000)
const past = new Date(Date.now() - 1000)

describe('isImpersonationSessionLive (privileged-session revocation rules)', () => {
  it('is live for an active, unexpired, un-ended, un-revoked session with an active Super Admin', () => {
    expect(isImpersonationSessionLive({ endedAt: null, revokedAt: null, expiresAt: future, superAdminActive: true })).toBe(true)
  })
  it('is dead once the session has ended (clean exit / logout)', () => {
    expect(isImpersonationSessionLive({ endedAt: new Date(), revokedAt: null, expiresAt: future, superAdminActive: true })).toBe(false)
  })
  it('is dead once the session is manually revoked', () => {
    expect(isImpersonationSessionLive({ endedAt: null, revokedAt: new Date(), expiresAt: future, superAdminActive: true })).toBe(false)
  })
  it('is dead once the session has expired', () => {
    expect(isImpersonationSessionLive({ endedAt: null, revokedAt: null, expiresAt: past, superAdminActive: true })).toBe(false)
  })
  it('is dead the moment the owning Super Admin is deactivated', () => {
    expect(isImpersonationSessionLive({ endedAt: null, revokedAt: null, expiresAt: future, superAdminActive: false })).toBe(false)
  })
  it('treats exactly-at-expiry as expired (boundary)', () => {
    const now = new Date()
    expect(isImpersonationSessionLive({ endedAt: null, revokedAt: null, expiresAt: now, superAdminActive: true }, now)).toBe(false)
  })
})
