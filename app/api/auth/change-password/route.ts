import bcrypt from 'bcrypt'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, setSessionCookie } from '@/lib/session'
import { logAudit } from '@/lib/audit'

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current and new password are required.' }, { status: 400 })
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 })
  }

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
