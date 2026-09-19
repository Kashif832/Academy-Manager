import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { canManageAcademy } from '@/lib/permissions'

function currentMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const students = await prisma.student.findMany({
    where: { academyId: user.academyId },
    orderBy: { fullName: 'asc' },
    include: {
      class: { select: { name: true, section: true } },
      feeInvoices: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
      attendanceRecords: { select: { status: true }, orderBy: { date: 'desc' }, take: 30 },
    },
  })

  const payload = students.map((student) => {
    const attendanceTotal = student.attendanceRecords.length
    const attendancePresent = student.attendanceRecords.filter(
      (r) => r.status === 'PRESENT' || r.status === 'LATE',
    ).length
    return {
      id: student.id,
      name: student.fullName,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      classId: student.classId,
      className: `${student.class.name} · ${student.class.section}`,
      status: student.status,
      monthlyFee: Number(student.monthlyFee),
      feeStatus: student.feeInvoices[0]?.status ?? 'PENDING',
      attendanceRate: attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : null,
      admissionDate: student.admissionDate,
    }
  })

  return NextResponse.json({ students: payload, canManage: canManageAcademy(user.role) })
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  if (!canManageAcademy(user.role)) {
    return NextResponse.json({ error: 'Only owners and admins can add students.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : ''
  const parentName = typeof body?.parentName === 'string' ? body.parentName.trim() : ''
  const parentPhone = typeof body?.parentPhone === 'string' ? body.parentPhone.trim() : ''
  const parentEmail = typeof body?.parentEmail === 'string' && body.parentEmail.trim() ? body.parentEmail.trim() : null
  const classId = typeof body?.classId === 'string' ? body.classId : ''
  const monthlyFee = Number(body?.monthlyFee)

  let dateOfBirth: Date | null = null
  if (typeof body?.dateOfBirth === 'string' && body.dateOfBirth.trim()) {
    const parsed = new Date(body.dateOfBirth)
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Date of birth is not a valid date.' }, { status: 400 })
    }
    dateOfBirth = parsed
  }

  if (!fullName || !parentName || !parentPhone || !classId) {
    return NextResponse.json({ error: 'Student name, parent name, parent phone and class are required.' }, { status: 400 })
  }
  if (!Number.isFinite(monthlyFee) || monthlyFee <= 0) {
    return NextResponse.json({ error: 'Monthly fee must be a positive number.' }, { status: 400 })
  }

  const cls = await prisma.class.findFirst({ where: { id: classId, academyId: user.academyId } })
  if (!cls) {
    return NextResponse.json({ error: 'Selected class was not found.' }, { status: 400 })
  }
  if (!cls.isActive) {
    return NextResponse.json({ error: 'This class is deactivated and cannot accept new students.' }, { status: 400 })
  }

  const now = new Date()
  const dueDate = new Date(now.getFullYear(), now.getMonth(), 10)

  const student = await prisma.student.create({
    data: {
      academyId: user.academyId,
      classId,
      fullName,
      parentName,
      parentPhone,
      parentEmail,
      dateOfBirth,
      monthlyFee,
      feeInvoices: {
        create: {
          academyId: user.academyId,
          month: currentMonthKey(now),
          amountDue: monthlyFee,
          amountPaid: 0,
          status: 'PENDING',
          dueDate,
        },
      },
    },
    include: { class: { select: { name: true, section: true } } },
  })

  return NextResponse.json({
    student: {
      id: student.id,
      name: student.fullName,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      className: `${student.class.name} · ${student.class.section}`,
      status: student.status,
      monthlyFee: Number(student.monthlyFee),
      feeStatus: 'PENDING',
      attendanceRate: null,
      admissionDate: student.admissionDate,
    },
  }, { status: 201 })
}
