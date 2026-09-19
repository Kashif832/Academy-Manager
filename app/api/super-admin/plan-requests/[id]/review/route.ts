import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/super-session'
import { logAudit } from '@/lib/audit'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.planUpgradeRequest.findUnique({ where: { id }, include: { academy: true } })
  if (!existing) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
  if (existing.status !== 'PENDING') {
    return NextResponse.json({ error: `This request has already been ${existing.status.toLowerCase()}.` }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  const decision = typeof body?.decision === 'string' ? body.decision : ''
  const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null

  if (decision !== 'APPROVED' && decision !== 'REJECTED') {
    return NextResponse.json({ error: 'Decision must be APPROVED or REJECTED.' }, { status: 400 })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const req = await tx.planUpgradeRequest.update({
      where: { id },
      data: { status: decision, adminNote: note, reviewedBySuperAdminId: superAdmin.id, reviewedAt: new Date() },
    })

    if (decision === 'APPROVED') {
      await tx.academy.update({ where: { id: existing.academyId }, data: { planTier: existing.requestedTier } })
    }

    return req
  })

  await logAudit({
    academyId: existing.academyId,
    superAdminId: superAdmin.id,
    action: decision === 'APPROVED' ? 'plan_request.approved' : 'plan_request.rejected',
    entityType: 'PlanUpgradeRequest',
    entityId: id,
    metadata: { from: existing.currentTier, to: existing.requestedTier, note },
  })
  if (decision === 'APPROVED') {
    await logAudit({
      academyId: existing.academyId,
      superAdminId: superAdmin.id,
      action: 'tenant.plan_changed',
      entityType: 'Academy',
      entityId: existing.academyId,
      metadata: { from: existing.currentTier, to: existing.requestedTier, viaRequestId: id },
    })
  }

  return NextResponse.json({
    request: { id: updated.id, status: updated.status, adminNote: updated.adminNote, reviewedAt: updated.reviewedAt },
  })
}
