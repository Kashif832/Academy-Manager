import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { canManageAcademy } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { tierNumber } from '@/lib/tiers'

const VALID_TIERS = new Set(['TRIAL', 'BASIC', 'PRO'])

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const latest = await prisma.planUpgradeRequest.findFirst({
    where: { academyId: user.academyId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    request: latest && {
      id: latest.id,
      currentTier: latest.currentTier,
      requestedTier: latest.requestedTier,
      status: latest.status,
      adminNote: latest.adminNote,
      createdAt: latest.createdAt,
      reviewedAt: latest.reviewedAt,
    },
  })
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  if (!canManageAcademy(user.role)) {
    return NextResponse.json({ error: 'Only owners and admins can request a plan change.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const requestedTier = typeof body?.requestedTier === 'string' ? body.requestedTier : ''
  if (!VALID_TIERS.has(requestedTier)) {
    return NextResponse.json({ error: 'Invalid plan tier.' }, { status: 400 })
  }

  const currentTier = user.academy.planTier
  if (requestedTier === currentTier) {
    return NextResponse.json({ error: 'You are already on this plan.' }, { status: 400 })
  }
  if (tierNumber(requestedTier) < tierNumber(currentTier)) {
    return NextResponse.json({ error: 'Downgrades must be arranged with the Academy Manager administrator directly.' }, { status: 400 })
  }

  const existingPending = await prisma.planUpgradeRequest.findFirst({
    where: { academyId: user.academyId, status: 'PENDING' },
  })
  if (existingPending) {
    return NextResponse.json({ error: `An upgrade request is already pending review. Please wait for it to be reviewed before submitting another.` }, { status: 409 })
  }

  const created = await prisma.planUpgradeRequest.create({
    data: {
      academyId: user.academyId,
      currentTier: currentTier as any,
      requestedTier: requestedTier as any,
      requestedByUserId: user.id,
      status: 'PENDING',
    },
  })

  await logAudit({
    academyId: user.academyId,
    userId: user.id,
    action: 'plan_request.created',
    entityType: 'PlanUpgradeRequest',
    entityId: created.id,
    metadata: { from: currentTier, to: requestedTier },
  })

  return NextResponse.json({
    request: { id: created.id, currentTier: created.currentTier, requestedTier: created.requestedTier, status: created.status, createdAt: created.createdAt },
  }, { status: 201 })
}
