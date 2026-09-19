import { NextResponse } from 'next/server'
import { clearSuperAdminSessionCookie, endImpersonation } from '@/lib/super-session'
import { clearSessionCookie } from '@/lib/session'
import { logAudit } from '@/lib/audit'

export async function POST() {
  // A platform logout must be a COMPLETE sign-out. If the Super Admin is still
  // inside a tenant, end that privileged session server-side too — otherwise a
  // held cookie could keep working after the operator believes they logged out.
  const ctx = await endImpersonation()

  await clearSuperAdminSessionCookie()
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
