import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/super-session'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { id } = await params
  const logs = await prisma.auditLog.findMany({
    where: { academyId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { fullName: true } }, superAdmin: { select: { fullName: true } } },
  })

  return NextResponse.json({
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      actorName: log.superAdmin?.fullName ?? log.user?.fullName ?? 'System',
      actorType: log.superAdminId ? 'SUPER_ADMIN' : log.userId ? 'USER' : 'SYSTEM',
      metadata: log.metadata,
      createdAt: log.createdAt,
    })),
  })
}
