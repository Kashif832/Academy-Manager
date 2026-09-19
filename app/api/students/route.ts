import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { canManageAcademy } from '@/lib/permissions'
import { getRequestId, jsonError } from '@/lib/http'
import { validateBody } from '@/lib/validation'
import { createStudentSchema } from '@/lib/schemas'

function currentMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  // Opt-in pagination: ?limit (1..200) + ?page (1-based). Without ?limit the
  // full list is returned (backward compatible). Pagination bounds the per-
  // student attendance/invoice sub-selects, which is the cost at large scale.
  const url = request.nextUrl
  const limitParam = Number(url.searchParams.get('limit'))
  const paginated = Number.isFinite(limitParam) && limitParam > 0
  const limit = paginated ? Math.min(200, Math.max(1, Math.trunc(limitParam))) : undefined
  const page = Math.max(1, Math.trunc(Number(url.searchParams.get('page')) || 1))
  const total = paginated ? await prisma.student.count({ where: { academyId: user.academyId } }) : undefined

  const students = await prisma.student.findMany({
    where: { academyId: user.academyId },
    orderBy: { fullName: 'asc' },
    ...(paginated ? { skip: (page - 1) * (limit as number), take: limit } : {}),
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

  return NextResponse.json({
    students: payload,
    canManage: canManageAcademy(user.role),
    ...(paginated ? { pagination: { page, limit, total, totalPages: Math.ceil((total as number) / (limit as number)) } } : {}),
  })
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  const user = await getSessionUser()
  if (!user) return jsonError(401, 'Not authenticated.', requestId)
  if (!canManageAcademy(user.role)) {
    return jsonError(403, 'Only owners and admins can add students.', requestId)
  }

  const parsed = await validateBody(request, createStudentSchema, requestId)
  if (!parsed.ok) return parsed.response
  const { fullName, parentName, parentPhone, classId, monthlyFee } = parsed.data
  const parentEmail = parsed.data.parentEmail?.trim() || null

  let dateOfBirth: Date | null = null
  if (parsed.data.dateOfBirth?.trim()) {
    const d = new Date(parsed.data.dateOfBirth)
    if (Number.isNaN(d.getTime())) return jsonError(400, 'Date of birth is not a valid date.', requestId)
    dateOfBirth = d
  }

  const cls = await prisma.class.findFirst({ where: { id: classId, academyId: user.academyId } })
  if (!cls) {
    return jsonError(400, 'Selected class was not found.', requestId)
  }
  if (!cls.isActive) {
    return jsonError(400, 'This class is deactivated and cannot accept new students.', requestId)
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
