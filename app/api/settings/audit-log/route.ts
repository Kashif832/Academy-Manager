import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { canManageAcademy } from '@/lib/permissions'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  if (!canManageAcademy(user.role)) {
    return NextResponse.json({ error: 'Only owners and admins can view the audit log.' }, { status: 403 })
  }

  const entries = await prisma.auditLog.findMany({
    where: { academyId: user.academyId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: { select: { fullName: true, email: true } } },
  })

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      metadata: e.metadata,
      createdAt: e.createdAt,
      userName: e.user?.fullName ?? 'Super Admin',
      userEmail: e.user?.email ?? null,
    })),
  })
}
