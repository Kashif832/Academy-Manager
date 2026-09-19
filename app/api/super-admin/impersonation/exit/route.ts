import { NextResponse } from 'next/server'
import { endImpersonation } from '@/lib/super-session'
import { logAudit } from '@/lib/audit'

// Clean exit back to the Super Admin platform context: ends the privileged
// session server-side and drops its cookie, leaving the Super Admin's own
// platform session intact.
export async function POST() {
  const ctx = await endImpersonation()

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
