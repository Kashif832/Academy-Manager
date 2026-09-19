import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin, startImpersonation } from '@/lib/super-session'
import { clientIp } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

// Opens a DEDICATED privileged session against a tenant (see lib/super-session.ts).
// The operator is NOT signed into the tenant's OWNER account; instead the acting
// user's role is assumed through a server-persisted, revocable session so every
// existing tenant module/route works untouched while remaining fully auditable.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { id } = await params
  const academy = await prisma.academy.findUnique({ where: { id } })
  if (!academy) return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 })

  // Assume the OWNER's role; fall back to any active ADMIN if a tenant somehow
  // has no owner account, so management is never a hard dead end.
  const actingUser = await prisma.user.findFirst({
    where: { academyId: id, role: 'OWNER' },
    orderBy: { createdAt: 'asc' },
  }) ?? await prisma.user.findFirst({
    where: { academyId: id, role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!actingUser) {
    return NextResponse.json({ error: 'This tenant has no owner or admin account to manage through.' }, { status: 409 })
  }

  const session = await startImpersonation({
    superAdminId: superAdmin.id,
    superAdminName: superAdmin.fullName,
    academyId: academy.id,
    academyName: academy.name,
    actingUserId: actingUser.id,
    actingRole: actingUser.role,
    ipAddress: clientIp(request),
    userAgent: request.headers.get('user-agent') ?? undefined,
  })

  await logAudit({
    academyId: academy.id,
    superAdminId: superAdmin.id,
    impersonationSessionId: session.id,
    action: 'tenant.impersonation_started',
    entityType: 'Academy',
    entityId: academy.id,
    metadata: { actingAsUserId: actingUser.id, actingAsEmail: actingUser.email, actingRole: actingUser.role },
  })

  return NextResponse.json({ ok: true, tenantName: academy.name })
}
