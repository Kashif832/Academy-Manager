import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/super-session'

export async function GET(request: NextRequest) {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const scope = request.nextUrl.searchParams.get('scope')

  const logs = await prisma.auditLog.findMany({
    where: scope === 'platform' ? { superAdminId: { not: null } } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      academy: { select: { name: true } },
      user: { select: { fullName: true } },
      superAdmin: { select: { fullName: true } },
    },
  })

  return NextResponse.json({
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      tenantName: log.academy?.name ?? null,
      actorName: log.superAdmin?.fullName ?? log.user?.fullName ?? 'System',
      actorType: log.superAdminId ? 'SUPER_ADMIN' : log.userId ? 'USER' : 'SYSTEM',
      metadata: log.metadata,
      createdAt: log.createdAt,
    })),
  })
}
