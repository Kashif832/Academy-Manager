import bcrypt from 'bcrypt'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, setSessionCookie } from '@/lib/session'
import { getRequestId, jsonError, requireWritable } from '@/lib/http'
import { validateBody } from '@/lib/validation'
import { changePasswordSchema } from '@/lib/schemas'
import { logAudit } from '@/lib/audit'

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  const user = await getSessionUser()
  if (!user) return jsonError(401, 'Not authenticated.', requestId)

  const notWritable = requireWritable(user, requestId)
  if (notWritable) return notWritable

  const parsed = await validateBody(request, changePasswordSchema, requestId)
  if (!parsed.ok) return parsed.response
  const { currentPassword, newPassword } = parsed.data

  const matches = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!matches) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })
  }

  // Bump the session epoch so every OTHER existing session for this user is
  // invalidated immediately (a stolen session cannot survive a password change).
  const passwordHash = await bcrypt.hash(newPassword, 12)
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, sessionEpoch: { increment: 1 } },
    select: { sessionEpoch: true },
  })
  // Re-issue THIS device's cookie at the new epoch so the user who just changed
  // their password stays signed in here while all their other sessions drop.
  if (!user.isImpersonation) {
    await setSessionCookie(user.id, updated.sessionEpoch)
  }

  await logAudit({
    academyId: user.academyId,
    userId: user.id,
    action: 'account.password_changed',
    entityType: 'User',
    entityId: user.id,
  })

  return NextResponse.json({ ok: true })
}
