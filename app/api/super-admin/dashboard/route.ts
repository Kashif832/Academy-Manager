import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/super-session'

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export async function GET() {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const thisMonthStart = startOfMonth(new Date())

  const [
    totalTenants,
    activeTenants,
    inactiveTenants,
    tierCounts,
    totalStudents,
    totalStaff,
    newTenantsThisMonth,
    recentTenants,
    recentLogs,
  ] = await Promise.all([
    prisma.academy.count(),
    prisma.academy.count({ where: { status: 'ACTIVE' } }),
    prisma.academy.count({ where: { status: 'INACTIVE' } }),
    prisma.academy.groupBy({ by: ['planTier'], _count: { _all: true } }),
    prisma.student.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.academy.count({ where: { createdAt: { gte: thisMonthStart } } }),
    prisma.academy.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, planTier: true, status: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        academy: { select: { name: true } },
        user: { select: { fullName: true } },
        superAdmin: { select: { fullName: true } },
      },
    }),
  ])

  const tierMap: Record<string, number> = { TRIAL: 0, BASIC: 0, PRO: 0 }
  for (const row of tierCounts) tierMap[row.planTier] = row._count._all

  return NextResponse.json({
    stats: {
      totalTenants,
      activeTenants,
      inactiveTenants,
      tier1Count: tierMap.TRIAL,
      tier2Count: tierMap.BASIC,
      tier3Count: tierMap.PRO,
      totalStudents,
      totalStaff,
      newTenantsThisMonth,
    },
    recentTenants,
    recentActivity: recentLogs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      tenantName: log.academy?.name ?? null,
      actorName: log.superAdmin?.fullName ?? log.user?.fullName ?? 'System',
      actorType: log.superAdminId ? 'SUPER_ADMIN' : log.userId ? 'USER' : 'SYSTEM',
      createdAt: log.createdAt,
    })),
  })
}
