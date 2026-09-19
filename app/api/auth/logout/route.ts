import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/session'
import { endImpersonation } from '@/lib/super-session'
import { logAudit } from '@/lib/audit'

export async function POST() {
  // If a Super Admin was managing this tenant and signs out via the normal
  // tenant "Sign out" button, end the privileged session cleanly (marks the
  // row ended server-side + drops the cookie) rather than leaving it live.
  const ctx = await endImpersonation()
  await clearSessionCookie()

  if (ctx) {
    await logAudit({
      academyId: ctx.tenantId,
      superAdminId: ctx.superAdminId,
      impersonationSessionId: ctx.sessionId,
      action: 'tenant.impersonation_ended',
      entityType: 'Academy',
      entityId: ctx.tenantId,
    })
  }

  return NextResponse.json({ ok: true })
}
