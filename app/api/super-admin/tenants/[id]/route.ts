import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/super-session'
import { logAudit } from '@/lib/audit'
import { tierLabel } from '@/lib/tiers'

const VALID_TIERS = new Set(['TRIAL', 'BASIC', 'PRO'])
const VALID_STATUSES = new Set(['ACTIVE', 'INACTIVE'])

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { id } = await params
  const academy = await prisma.academy.findUnique({
    where: { id },
    include: {
      users: { orderBy: { createdAt: 'asc' }, select: { id: true, fullName: true, email: true, role: true, isActive: true, createdAt: true } },
      _count: { select: { students: true, classes: true, feeInvoices: true } },
    },
  })
  if (!academy) return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 })

  const [activeStudents, feeAgg] = await Promise.all([
    prisma.student.count({ where: { academyId: id, status: 'ACTIVE' } }),
    prisma.feeInvoice.aggregate({ where: { academyId: id }, _sum: { amountDue: true, amountPaid: true } }),
  ])

  return NextResponse.json({
    tenant: {
      id: academy.id,
      name: academy.name,
      slug: academy.slug,
      logoUrl: academy.logoUrl,
      phone: academy.phone,
      whatsapp: academy.whatsapp,
      address: academy.address,
      openingHours: academy.openingHours,
      description: academy.description,
      planTier: academy.planTier,
      planLabel: tierLabel(academy.planTier),
      status: academy.status,
      trialEndsAt: academy.trialEndsAt,
      createdAt: academy.createdAt,
      updatedAt: academy.updatedAt,
      users: academy.users,
      counts: {
        students: activeStudents,
        totalStudentsEver: academy._count.students,
        classes: academy._count.classes,
        invoices: academy._count.feeInvoices,
      },
      fees: {
        totalDue: Number(feeAgg._sum.amountDue ?? 0),
        totalPaid: Number(feeAgg._sum.amountPaid ?? 0),
      },
    },
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.academy.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })

  const data: Record<string, unknown> = {}
  const auditEvents: { action: string; metadata: Record<string, unknown> }[] = []

  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Academy name is required.' }, { status: 400 })
    data.name = name
  }
  if ('phone' in body) data.phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null
  if ('address' in body) data.address = typeof body.address === 'string' && body.address.trim() ? body.address.trim() : null
  if ('description' in body) data.description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null

  if ('planTier' in body) {
    const planTier = typeof body.planTier === 'string' ? body.planTier : ''
    if (!VALID_TIERS.has(planTier)) return NextResponse.json({ error: 'Invalid plan tier.' }, { status: 400 })
    if (planTier !== existing.planTier) {
      data.planTier = planTier
      auditEvents.push({ action: 'tenant.plan_changed', metadata: { from: existing.planTier, to: planTier } })
    }
  }

  if ('status' in body) {
    const status = typeof body.status === 'string' ? body.status : ''
    if (!VALID_STATUSES.has(status)) return NextResponse.json({ error: 'Invalid tenant status.' }, { status: 400 })
    if (status !== existing.status) {
      data.status = status
      auditEvents.push({ action: status === 'ACTIVE' ? 'tenant.activated' : 'tenant.deactivated', metadata: { from: existing.status, to: status } })
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No changes provided.' }, { status: 400 })
  }

  const updated = await prisma.academy.update({ where: { id }, data })

  if (auditEvents.length === 0) {
    auditEvents.push({ action: 'tenant.updated', metadata: { fields: Object.keys(data) } })
  }
  for (const event of auditEvents) {
    await logAudit({
      academyId: id,
      superAdminId: superAdmin.id,
      action: event.action,
      entityType: 'Academy',
      entityId: id,
      metadata: event.metadata,
    })
  }

  return NextResponse.json({
    tenant: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      phone: updated.phone,
      address: updated.address,
      description: updated.description,
      planTier: updated.planTier,
      planLabel: tierLabel(updated.planTier),
      status: updated.status,
      createdAt: updated.createdAt,
    },
  })
}
