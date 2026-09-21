import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { requireWritable } from '@/lib/http'
import { canManageAcademy } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { sanitizeElectiveSubjects, sanitizePublicSubjects, type ElectiveSubject } from '@/lib/site-content'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const notWritable = requireWritable(user)
  if (notWritable) return notWritable
  if (!canManageAcademy(user.role)) {
    return NextResponse.json({ error: 'Only owners and admins can edit classes.' }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.class.findFirst({ where: { id, academyId: user.academyId } })
  if (!existing) return NextResponse.json({ error: 'Class not found.' }, { status: 404 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })

  const data: Record<string, unknown> = {}
  const nextName = 'name' in body ? (typeof body.name === 'string' ? body.name.trim() : '') : existing.name
  const nextSection = 'section' in body ? (typeof body.section === 'string' ? body.section.trim() : '') : existing.section

  if ('name' in body) {
    if (!nextName) return NextResponse.json({ error: 'Class name is required.' }, { status: 400 })
    data.name = nextName
  }
  if ('section' in body) {
    if (!nextSection) return NextResponse.json({ error: 'Section is required.' }, { status: 400 })
    data.section = nextSection
  }
  if ('name' in body || 'section' in body) {
    const clash = await prisma.class.findFirst({ where: { academyId: user.academyId, name: nextName, section: nextSection, NOT: { id } } })
    if (clash) return NextResponse.json({ error: 'A class with this name and section already exists.' }, { status: 400 })
  }
  if ('monthlyFee' in body) {
    const monthlyFee = Number(body.monthlyFee)
    if (!Number.isFinite(monthlyFee) || monthlyFee <= 0) {
      return NextResponse.json({ error: 'Monthly fee must be a positive number.' }, { status: 400 })
    }
    data.monthlyFee = monthlyFee
  }
  if ('teacherId' in body) {
    const teacherId = typeof body.teacherId === 'string' && body.teacherId ? body.teacherId : null
    if (teacherId) {
      const teacher = await prisma.user.findFirst({ where: { id: teacherId, academyId: user.academyId } })
      if (!teacher) return NextResponse.json({ error: 'Selected teacher was not found.' }, { status: 400 })
    }
    data.teacherId = teacherId
  }
  if ('isActive' in body) {
    data.isActive = Boolean(body.isActive)
  }
  if ('publicVisible' in body) {
    data.publicVisible = Boolean(body.publicVisible)
  }
  if ('publicDescription' in body) {
    data.publicDescription = typeof body.publicDescription === 'string' && body.publicDescription.trim() ? body.publicDescription.trim().slice(0, 300) : null
  }
  if ('publicSubjects' in body) {
    data.publicSubjects = sanitizePublicSubjects(body.publicSubjects)
  }
  if ('electiveSubjects' in body) {
    data.electiveSubjects = sanitizeElectiveSubjects(body.electiveSubjects)
  }

  const updated = await prisma.class.update({
    where: { id },
    data,
    include: { teacher: { select: { fullName: true } }, _count: { select: { students: { where: { status: 'ACTIVE' } } } } },
  })

  await logAudit({
    academyId: user.academyId,
    userId: user.id,
    action: 'isActive' in data ? `class.${updated.isActive ? 'activated' : 'deactivated'}` : 'class.updated',
    entityType: 'Class',
    entityId: updated.id,
    metadata: { name: updated.name, section: updated.section },
  })

  return NextResponse.json({
    class: {
      id: updated.id,
      name: updated.name,
      section: updated.section,
      monthlyFee: Number(updated.monthlyFee),
      teacherId: updated.teacherId,
      teacherName: updated.teacher?.fullName ?? null,
      studentCount: updated._count.students,
      isActive: updated.isActive,
      publicVisible: updated.publicVisible,
      publicDescription: updated.publicDescription,
      publicSubjects: updated.publicSubjects,
      electiveSubjects: updated.electiveSubjects as unknown as ElectiveSubject[],
    },
  })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const notWritable = requireWritable(user)
  if (notWritable) return notWritable
  if (!canManageAcademy(user.role)) {
    return NextResponse.json({ error: 'Only owners and admins can delete classes.' }, { status: 403 })
  }

  const { id } = await params
  const cls = await prisma.class.findFirst({ where: { id, academyId: user.academyId }, select: { id: true, name: true, section: true } })
  if (!cls) return NextResponse.json({ error: 'Class not found.' }, { status: 404 })

  const [studentCount, attendanceCount] = await Promise.all([
    prisma.student.count({ where: { classId: id } }),
    prisma.attendanceRecord.count({ where: { classId: id } }),
  ])

  if (studentCount > 0) {
    return NextResponse.json({
      error: `Cannot delete this class because ${studentCount} student${studentCount === 1 ? ' is' : 's are'} currently assigned to it. Deactivate the class instead.`,
      reason: 'has_students',
    }, { status: 409 })
  }
  if (attendanceCount > 0) {
    return NextResponse.json({
      error: 'Cannot delete this class because it has historical attendance records. Deactivate the class instead to preserve them.',
      reason: 'has_records',
    }, { status: 409 })
  }

  await prisma.class.delete({ where: { id } })

  await logAudit({
    academyId: user.academyId,
    userId: user.id,
    action: 'class.deleted',
    entityType: 'Class',
    entityId: id,
    metadata: { name: cls.name, section: cls.section },
  })

  return NextResponse.json({ success: true })
}
