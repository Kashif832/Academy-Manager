import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { getRequestId, jsonError, requireWritable } from '@/lib/http'
import { validateBody } from '@/lib/validation'
import { planRequestSchema } from '@/lib/schemas'
import { canManageAcademy } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { tierNumber } from '@/lib/tiers'

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
  const requestId = getRequestId(request)
  const user = await getSessionUser()
  if (!user) return jsonError(401, 'Not authenticated.', requestId)

  const notWritable = requireWritable(user, requestId)
  if (notWritable) return notWritable
  if (!canManageAcademy(user.role)) {
    return jsonError(403, 'Only owners and admins can request a plan change.', requestId)
  }

  const parsed = await validateBody(request, planRequestSchema, requestId)
  if (!parsed.ok) return parsed.response
  const requestedTier = parsed.data.requestedTier

  const currentTier = user.academy.planTier
  if (requestedTier === currentTier) {
    return jsonError(400, 'You are already on this plan.', requestId)
  }
  if (tierNumber(requestedTier) < tierNumber(currentTier)) {
    return jsonError(400, 'Downgrades must be arranged with the Academy Manager administrator directly.', requestId)
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
