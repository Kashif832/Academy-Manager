import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { requireWritable } from '@/lib/http'
import { canManageAcademy } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

const VALID_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'GRADUATED'])

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { id } = await params
  const student = await prisma.student.findFirst({
    where: { id, academyId: user.academyId },
    include: {
      class: { select: { id: true, name: true, section: true } },
      feeInvoices: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
      attendanceRecords: { select: { status: true }, orderBy: { date: 'desc' }, take: 30 },
    },
  })
  if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 })

  const attendanceTotal = student.attendanceRecords.length
  const attendancePresent = student.attendanceRecords.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length

  return NextResponse.json({
    student: {
      id: student.id,
      name: student.fullName,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      parentEmail: student.parentEmail,
      dateOfBirth: student.dateOfBirth,
      admissionDate: student.admissionDate,
      classId: student.classId,
      className: `${student.class.name} · ${student.class.section}`,
      status: student.status,
      monthlyFee: Number(student.monthlyFee),
      feeStatus: student.feeInvoices[0]?.status ?? 'PENDING',
      attendanceRate: attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : null,
    },
    canManage: canManageAcademy(user.role),
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const notWritable = requireWritable(user)
  if (notWritable) return notWritable
  if (!canManageAcademy(user.role)) {
    return NextResponse.json({ error: 'Only owners and admins can edit students.' }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.student.findFirst({ where: { id, academyId: user.academyId } })
  if (!existing) return NextResponse.json({ error: 'Student not found.' }, { status: 404 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })

  const data: Record<string, unknown> = {}

  if ('fullName' in body) {
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    if (!fullName) return NextResponse.json({ error: 'Student name is required.' }, { status: 400 })
    data.fullName = fullName
  }
  if ('parentName' in body) {
    const parentName = typeof body.parentName === 'string' ? body.parentName.trim() : ''
    if (!parentName) return NextResponse.json({ error: 'Parent name is required.' }, { status: 400 })
    data.parentName = parentName
  }
  if ('parentPhone' in body) {
    const parentPhone = typeof body.parentPhone === 'string' ? body.parentPhone.trim() : ''
    if (!parentPhone) return NextResponse.json({ error: 'Parent phone is required.' }, { status: 400 })
    data.parentPhone = parentPhone
  }
  if ('parentEmail' in body) {
    data.parentEmail = typeof body.parentEmail === 'string' && body.parentEmail.trim() ? body.parentEmail.trim() : null
  }
  if ('dateOfBirth' in body) {
    if (typeof body.dateOfBirth === 'string' && body.dateOfBirth.trim()) {
      const parsed = new Date(body.dateOfBirth)
      if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: 'Date of birth is not a valid date.' }, { status: 400 })
      data.dateOfBirth = parsed
    } else {
      data.dateOfBirth = null
    }
  }
  if ('admissionDate' in body) {
    const parsed = new Date(body.admissionDate)
    if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: 'Admission date is not a valid date.' }, { status: 400 })
    data.admissionDate = parsed
  }
  if ('monthlyFee' in body) {
    const monthlyFee = Number(body.monthlyFee)
    if (!Number.isFinite(monthlyFee) || monthlyFee <= 0) {
      return NextResponse.json({ error: 'Monthly fee must be a positive number.' }, { status: 400 })
    }
    data.monthlyFee = monthlyFee
  }
  if ('status' in body) {
    const status = typeof body.status === 'string' ? body.status : ''
    if (!VALID_STATUSES.has(status)) return NextResponse.json({ error: 'Invalid student status.' }, { status: 400 })
    data.status = status
  }
  if ('classId' in body) {
    const classId = typeof body.classId === 'string' ? body.classId : ''
    const cls = await prisma.class.findFirst({ where: { id: classId, academyId: user.academyId } })
    if (!cls) return NextResponse.json({ error: 'Selected class was not found.' }, { status: 400 })
    if (!cls.isActive && classId !== existing.classId) {
      return NextResponse.json({ error: 'This class is deactivated and cannot accept new students.' }, { status: 400 })
    }
    data.classId = classId
  }

  const updated = await prisma.student.update({
    where: { id },
    data,
    include: { class: { select: { name: true, section: true } } },
  })

  await logAudit({
    academyId: user.academyId,
    userId: user.id,
    action: existing.status !== updated.status ? `student.status.${updated.status.toLowerCase()}` : 'student.updated',
    entityType: 'Student',
    entityId: updated.id,
    metadata: { fullName: updated.fullName },
  })

  return NextResponse.json({
    student: {
      id: updated.id,
      name: updated.fullName,
      parentName: updated.parentName,
      parentPhone: updated.parentPhone,
      parentEmail: updated.parentEmail,
      dateOfBirth: updated.dateOfBirth,
      admissionDate: updated.admissionDate,
      classId: updated.classId,
      className: `${updated.class.name} · ${updated.class.section}`,
      status: updated.status,
      monthlyFee: Number(updated.monthlyFee),
    },
  })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const notWritable = requireWritable(user)
  if (notWritable) return notWritable
  if (!canManageAcademy(user.role)) {
    return NextResponse.json({ error: 'Only owners and admins can delete students.' }, { status: 403 })
  }

  const { id } = await params
  const student = await prisma.student.findFirst({ where: { id, academyId: user.academyId }, select: { id: true, fullName: true } })
  if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 })

  const [attendanceCount, paymentCount] = await Promise.all([
    prisma.attendanceRecord.count({ where: { studentId: id } }),
    prisma.feePayment.count({ where: { invoice: { studentId: id } } }),
  ])

  if (attendanceCount > 0 || paymentCount > 0) {
    return NextResponse.json({
      error: `Cannot permanently delete this student because they have ${attendanceCount > 0 ? `${attendanceCount} attendance record${attendanceCount === 1 ? '' : 's'}` : ''}${attendanceCount > 0 && paymentCount > 0 ? ' and ' : ''}${paymentCount > 0 ? `${paymentCount} payment record${paymentCount === 1 ? '' : 's'}` : ''}. Deactivate the student instead to preserve their history.`,
    }, { status: 409 })
  }

  // Safe to delete: no attendance or payment history exists, so the only cascade
  // is the student's own (unpaid) fee invoices — nothing financial is lost.
  await prisma.student.delete({ where: { id } })

  await logAudit({
    academyId: user.academyId,
    userId: user.id,
    action: 'student.deleted',
    entityType: 'Student',
    entityId: id,
    metadata: { fullName: student.fullName },
  })

  return NextResponse.json({ success: true })
}
