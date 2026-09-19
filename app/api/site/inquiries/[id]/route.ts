import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { logAudit } from '@/lib/audit'

const VALID_STATUSES = new Set(['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'APPLICATION', 'ACCEPTED', 'ENROLLED', 'LOST'])

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.siteInquiry.findFirst({ where: { id, academyId: user.academyId } })
  if (!existing) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })

  const data: Record<string, unknown> = {}

  if ('status' in body) {
    const status = typeof body.status === 'string' ? body.status : ''
    if (!VALID_STATUSES.has(status)) return NextResponse.json({ error: 'Invalid lead status.' }, { status: 400 })
    data.status = status
  }
  if ('notes' in body) {
    data.notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 2000) : null
  }
  if ('nextFollowUpAt' in body) {
    if (typeof body.nextFollowUpAt === 'string' && body.nextFollowUpAt.trim()) {
      const parsed = new Date(body.nextFollowUpAt)
      if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: 'Follow-up date is not valid.' }, { status: 400 })
      data.nextFollowUpAt = parsed
    } else {
      data.nextFollowUpAt = null
    }
  }
  if ('assignedToUserId' in body) {
    const assignedToUserId = typeof body.assignedToUserId === 'string' && body.assignedToUserId ? body.assignedToUserId : null
    if (assignedToUserId) {
      const staff = await prisma.user.findFirst({ where: { id: assignedToUserId, academyId: user.academyId } })
      if (!staff) return NextResponse.json({ error: 'Selected staff member was not found.' }, { status: 400 })
    }
    data.assignedToUserId = assignedToUserId
  }
  if ('convertedStudentId' in body) {
    const convertedStudentId = typeof body.convertedStudentId === 'string' && body.convertedStudentId ? body.convertedStudentId : null
    if (convertedStudentId) {
      // Cross-tenant integrity: the referenced student MUST belong to this
      // academy. Never trust a browser-supplied student id.
      const student = await prisma.student.findFirst({ where: { id: convertedStudentId, academyId: user.academyId }, select: { id: true } })
      if (!student) return NextResponse.json({ error: 'Converted student was not found in this academy.' }, { status: 400 })
      // Prevent the same student being used to convert two different leads.
      const alreadyLinked = await prisma.siteInquiry.findFirst({
        where: { academyId: user.academyId, convertedStudentId, NOT: { id } },
        select: { id: true },
      })
      if (alreadyLinked) return NextResponse.json({ error: 'This student is already linked to another enquiry.' }, { status: 409 })
    }
    data.convertedStudentId = convertedStudentId
  }

  const updated = await prisma.siteInquiry.update({
    where: { id },
    data,
    include: { interestedClass: { select: { name: true, section: true } }, assignedTo: { select: { fullName: true } } },
  })

  await logAudit({
    academyId: user.academyId,
    userId: user.id,
    action: 'lead.updated',
    entityType: 'SiteInquiry',
    entityId: updated.id,
    metadata: { name: updated.name, status: updated.status },
  })

  return NextResponse.json({
    lead: {
      id: updated.id,
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      message: updated.message,
      studentName: updated.studentName,
      interestedClassId: updated.interestedClassId,
      interestedClassName: updated.interestedClass ? `${updated.interestedClass.name} · ${updated.interestedClass.section}` : null,
      source: updated.source,
      status: updated.status,
      notes: updated.notes,
      nextFollowUpAt: updated.nextFollowUpAt,
      assignedToUserId: updated.assignedToUserId,
      assignedToName: updated.assignedTo?.fullName ?? null,
      convertedStudentId: updated.convertedStudentId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    },
  })
}
