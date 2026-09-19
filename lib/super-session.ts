import crypto from 'crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

// Deliberately separate cookie from the tenant session (lib/session.ts) so a
// Super Admin session can never be confused with — or reused as — a tenant
// user session, and vice versa. Same HMAC-signed-token approach as the
// tenant session, reusing SESSION_SECRET (no new secret/dependency needed —
// the tokens carry different payload shapes/prefixes and live in different
// cookies, so one can never be replayed as another).
const COOKIE_NAME = 'super_admin_session'
const SESSION_TTL_SECONDS = 60 * 60 * 12 // 12 hours — shorter-lived given the privilege level

function getSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')
  return secret
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url')
}

function sign(payload: string) {
  return crypto.createHmac('sha256', getSecret()).update(`super-admin:${payload}`).digest('base64url')
}

function timingSafeEqualStr(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}

export function createSuperAdminSessionToken(superAdminId: string) {
  const payload = JSON.stringify({ superAdminId, exp: Date.now() + SESSION_TTL_SECONDS * 1000 })
  const encodedPayload = base64url(payload)
  const signature = sign(encodedPayload)
  return `${encodedPayload}.${signature}`
}

function verifySuperAdminSessionToken(token: string): { superAdminId: string } | null {
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null
  if (!timingSafeEqualStr(signature, sign(encodedPayload))) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
    if (typeof payload.superAdminId !== 'string' || typeof payload.exp !== 'number') return null
    if (Date.now() > payload.exp) return null
    return { superAdminId: payload.superAdminId }
  } catch {
    return null
  }
}

export async function setSuperAdminSessionCookie(superAdminId: string) {
  const store = await cookies()
  store.set(COOKIE_NAME, createSuperAdminSessionToken(superAdminId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export async function clearSuperAdminSessionCookie() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export async function getSuperAdmin() {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null

  const session = verifySuperAdminSessionToken(token)
  if (!session) return null

  const superAdmin = await prisma.superAdmin.findUnique({ where: { id: session.superAdminId } })
  if (!superAdmin || !superAdmin.isActive) return null

  return superAdmin
}

// ─── Impersonation ("Manage Tenant") — dedicated privileged session ─────────
//
// A Super Admin managing a tenant no longer signs into the tenant's OWNER
// account through the normal tenant session. Instead we mint a DEDICATED
// privileged session: a server-persisted `ImpersonationSession` row plus an
// `impersonation_session` cookie whose token only REFERENCES that row by id.
//
// The row is the source of truth for the acting context (Super Admin actor +
// selected tenant + which tenant user's role is assumed). Because access is
// re-resolved from the row on every request, ending it, revoking it, letting it
// expire, or deactivating the Super Admin all cut off access server-side on the
// very next request — a stale/forged cookie on its own grants nothing.
//
// Every existing tenant route/module keeps working unchanged because
// getSessionUser() (lib/session.ts) resolves this into the same acting-user
// shape a normal tenant login produces.
const IMPERSONATION_COOKIE_NAME = 'impersonation_session'
const IMPERSONATION_TTL_SECONDS = 60 * 60 * 4 // 4 hours

function signImpersonation(payload: string) {
  return crypto.createHmac('sha256', getSecret()).update(`impersonation-session:${payload}`).digest('base64url')
}

type ImpersonationTokenPayload = {
  sid: string
  superAdminId: string
  superAdminName: string
  tenantId: string
  tenantName: string
  actingUserId: string
  actingRole: string
  exp: number
}

function createImpersonationToken(p: Omit<ImpersonationTokenPayload, 'exp'> & { exp: number }) {
  const encodedPayload = base64url(JSON.stringify(p))
  return `${encodedPayload}.${signImpersonation(encodedPayload)}`
}

function verifyImpersonationToken(token: string): ImpersonationTokenPayload | null {
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null
  if (!timingSafeEqualStr(signature, signImpersonation(encodedPayload))) return null
  try {
    const p = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
    if (typeof p.sid !== 'string' || typeof p.superAdminId !== 'string' || typeof p.tenantId !== 'string') return null
    if (typeof p.actingUserId !== 'string' || typeof p.exp !== 'number') return null
    if (Date.now() > p.exp) return null
    return p as ImpersonationTokenPayload
  } catch {
    return null
  }
}

export type ImpersonationContext = {
  sessionId: string
  superAdminId: string
  superAdminName: string
  tenantId: string
  tenantName: string
  actingUserId: string
  actingRole: string
}

// Pure predicate for whether a persisted impersonation session may still grant
// access. Extracted so the exact revocation/expiry/deactivation rules can be
// unit-tested in CI without a database or request scope. A session is live only
// when it has NOT ended, has NOT been revoked, has NOT expired, and its owning
// Super Admin account is still active.
export function isImpersonationSessionLive(
  s: { endedAt: Date | null; revokedAt: Date | null; expiresAt: Date; superAdminActive: boolean },
  now: Date = new Date(),
): boolean {
  if (s.endedAt || s.revokedAt) return false
  if (s.expiresAt.getTime() <= now.getTime()) return false
  if (!s.superAdminActive) return false
  return true
}

// Start a privileged session. Persists the row FIRST (source of truth), then
// issues the cookie that references it. Returns the row so the caller can audit.
export async function startImpersonation(opts: {
  superAdminId: string
  superAdminName: string
  academyId: string
  academyName: string
  actingUserId: string
  actingRole: string
  ipAddress?: string
  userAgent?: string
}) {
  const expiresAt = new Date(Date.now() + IMPERSONATION_TTL_SECONDS * 1000)
  const session = await prisma.impersonationSession.create({
    data: {
      superAdminId: opts.superAdminId,
      academyId: opts.academyId,
      actingUserId: opts.actingUserId,
      actingRole: opts.actingRole,
      expiresAt,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    },
  })
  const store = await cookies()
  store.set(
    IMPERSONATION_COOKIE_NAME,
    createImpersonationToken({
      sid: session.id,
      superAdminId: opts.superAdminId,
      superAdminName: opts.superAdminName,
      tenantId: opts.academyId,
      tenantName: opts.academyName,
      actingUserId: opts.actingUserId,
      actingRole: opts.actingRole,
      exp: expiresAt.getTime(),
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: IMPERSONATION_TTL_SECONDS,
    },
  )
  return session
}

// End the active impersonation cleanly: mark the row ended (idempotent) and drop
// the cookie. Returns the context that was active, so the caller can audit exit.
export async function endImpersonation(): Promise<ImpersonationContext | null> {
  const ctx = await getActiveImpersonation()
  const store = await cookies()
  store.delete(IMPERSONATION_COOKIE_NAME)
  if (ctx) {
    await prisma.impersonationSession
      .updateMany({ where: { id: ctx.sessionId, endedAt: null }, data: { endedAt: new Date() } })
      .catch(() => {})
  }
  return ctx
}

// Manual revocation — kills a specific session server-side regardless of who
// currently holds the cookie. Safe to call on an already-ended/revoked row.
export async function revokeImpersonationSession(sessionId: string, reason?: string) {
  return prisma.impersonationSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason ?? null },
  })
}

// The core resolver: returns the acting context ONLY when the cookie is valid
// AND the persisted session is still live (not ended, not revoked, not expired)
// AND the owning Super Admin account is still active. Anything else → null.
export async function getActiveImpersonation(): Promise<ImpersonationContext | null> {
  let token: string | undefined
  try {
    const store = await cookies()
    token = store.get(IMPERSONATION_COOKIE_NAME)?.value
  } catch {
    return null // cookies() can throw outside a request scope — non-fatal.
  }
  if (!token) return null

  const p = verifyImpersonationToken(token)
  if (!p) return null

  const session = await prisma.impersonationSession.findUnique({
    where: { id: p.sid },
    include: { superAdmin: true },
  })
  if (!session) return null
  if (
    !isImpersonationSessionLive({
      endedAt: session.endedAt,
      revokedAt: session.revokedAt,
      expiresAt: session.expiresAt,
      superAdminActive: Boolean(session.superAdmin && session.superAdmin.isActive),
    })
  ) {
    return null
  }
  // The cookie must still agree with the persisted row (defense in depth).
  if (session.superAdminId !== p.superAdminId || session.academyId !== p.tenantId || session.actingUserId !== p.actingUserId) {
    return null
  }

  return {
    sessionId: session.id,
    superAdminId: session.superAdminId,
    superAdminName: p.superAdminName,
    tenantId: session.academyId,
    tenantName: p.tenantName,
    actingUserId: session.actingUserId,
    actingRole: session.actingRole,
  }
}

// ─── Backward-compatible surface (kept so existing routes/audit need no change).

// Previously proved a signed cookie + a live platform session. Now proves a live
// PERSISTED privileged session (strictly stronger — server-side revocable).
export async function getVerifiedImpersonation(): Promise<ImpersonationContext | null> {
  return getActiveImpersonation()
}

// UI banner / auth "me" payload. Same field names the client already consumes.
export async function getImpersonationContext(): Promise<
  { superAdminId: string; superAdminName: string; tenantId: string; tenantName: string } | null
> {
  const ctx = await getActiveImpersonation()
  if (!ctx) return null
  return { superAdminId: ctx.superAdminId, superAdminName: ctx.superAdminName, tenantId: ctx.tenantId, tenantName: ctx.tenantName }
}

// Used by tenant-facing tier gates (reports, website CMS) and the inactive-
// tenant access exception so a Super Admin actively managing a tenant is not
// blocked by that tenant's plan/status. True only when a live privileged
// session names the exact academy — so it can neither leak to another tenant
// nor survive session end/revocation/expiry or Super Admin deactivation.
export async function isImpersonatingTenant(academyId: string) {
  const ctx = await getActiveImpersonation()
  return Boolean(ctx && ctx.tenantId === academyId)
}

// Audit attribution metadata for actions taken inside a privileged session.
export async function auditActor(): Promise<{
  actorType: 'USER' | 'IMPERSONATED_SUPER_ADMIN'
  superAdminId?: string
  superAdminName?: string
  impersonationSessionId?: string
}> {
  const ctx = await getActiveImpersonation()
  if (ctx) {
    return {
      actorType: 'IMPERSONATED_SUPER_ADMIN',
      superAdminId: ctx.superAdminId,
      superAdminName: ctx.superAdminName,
      impersonationSessionId: ctx.sessionId,
    }
  }
  return { actorType: 'USER' }
}
