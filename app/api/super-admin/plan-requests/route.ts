import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/super-session'

export async function GET() {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const requests = await prisma.planUpgradeRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      academy: { select: { name: true } },
      requestedBy: { select: { fullName: true, email: true } },
      reviewedBySuperAdmin: { select: { fullName: true } },
    },
  })

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      academyId: r.academyId,
      tenantName: r.academy.name,
      currentTier: r.currentTier,
      requestedTier: r.requestedTier,
      status: r.status,
      requestedByName: r.requestedBy.fullName,
      requestedByEmail: r.requestedBy.email,
      adminNote: r.adminNote,
      reviewedByName: r.reviewedBySuperAdmin?.fullName ?? null,
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
    })),
  })
}
