import crypto from 'crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getActiveImpersonation } from '@/lib/super-session'

const COOKIE_NAME = 'academy_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

function getSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')
  return secret
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url')
}

function sign(payload: string) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

export function createSessionToken(userId: string, epoch: number = 0, ttlSeconds: number = SESSION_TTL_SECONDS) {
  const payload = JSON.stringify({ userId, epoch, exp: Date.now() + ttlSeconds * 1000 })
  const encodedPayload = base64url(payload)
  const signature = sign(encodedPayload)
  return `${encodedPayload}.${signature}`
}

function verifySessionToken(token: string): { userId: string; epoch: number } | null {
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null

  const expectedSignature = sign(encodedPayload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expectedSignature)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
    if (typeof payload.userId !== 'string' || typeof payload.exp !== 'number') return null
    if (Date.now() > payload.exp) return null
    // epoch is optional for backward compatibility with tokens minted before it
    // existed; those are treated as epoch 0.
    return { userId: payload.userId, epoch: typeof payload.epoch === 'number' ? payload.epoch : 0 }
  } catch {
    return null
  }
}

export async function setSessionCookie(userId: string, epoch: number = 0, ttlSeconds: number = SESSION_TTL_SECONDS) {
  const store = await cookies()
  store.set(COOKIE_NAME, createSessionToken(userId, epoch, ttlSeconds), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ttlSeconds,
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export async function getSessionUser() {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value

  // 1. Normal tenant session.
  if (token) {
    const session = verifySessionToken(token)
    if (session) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        include: { academy: true },
      })
      // Defense in depth: a Super Admin deactivating a user or a tenant mid-
      // session must cut them off immediately, not just block future logins.
      // A stale epoch (e.g. after a password change) also invalidates the token.
      if (
        user &&
        user.isActive &&
        user.sessionEpoch === session.epoch &&
        user.academy &&
        user.academy.status === 'ACTIVE'
      ) {
        return Object.assign(user, { isImpersonation: false as const })
      }
    }
  }

  // 2. Dedicated Super Admin impersonation session. Resolved from the
  // server-persisted ImpersonationSession row (getActiveImpersonation already
  // enforces not-ended / not-revoked / not-expired / Super Admin still active),
  // so a Super Admin managing a tenant gets the acting user's context — the
  // same shape a normal login yields — and every existing route works unchanged.
  // This is also the one path allowed into an INACTIVE academy, because the
  // operator may be managing precisely to inspect or reactivate it.
  const imp = await getActiveImpersonation()
  if (imp) {
    const actingUser = await prisma.user.findUnique({
      where: { id: imp.actingUserId },
      include: { academy: true },
    })
    if (actingUser && actingUser.academyId === imp.tenantId && actingUser.academy) {
      return Object.assign(actingUser, {
        isImpersonation: true as const,
        impersonationSuperAdminId: imp.superAdminId,
        impersonationSessionId: imp.sessionId,
      })
    }
  }

  return null
}
