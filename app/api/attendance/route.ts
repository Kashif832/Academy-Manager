import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { requireWritable } from '@/lib/http'

const VALID_STATUSES = new Set(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])

function dateKeyToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const dateParam = request.nextUrl.searchParams.get('date') ?? dateKeyToday()
  const dayStart = parseDateKey(dateParam)
  if (!dayStart) return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })

  const [students, records] = await Promise.all([
    prisma.student.findMany({
      where: { academyId: user.academyId, status: 'ACTIVE' },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, classId: true, class: { select: { name: true, section: true } } },
    }),
    prisma.attendanceRecord.findMany({
      where: { academyId: user.academyId, date: dayStart },
      select: { studentId: true, status: true },
    }),
  ])

  const statusByStudent = new Map(records.map((r) => [r.studentId, r.status]))

  return NextResponse.json({
    date: dateParam,
    students: students.map((s) => ({
      id: s.id,
      name: s.fullName,
      classId: s.classId,
      className: `${s.class.name} · ${s.class.section}`,
      status: statusByStudent.get(s.id) ?? null,
    })),
  })
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const notWritable = requireWritable(user)
  if (notWritable) return notWritable

  const body = await request.json().catch(() => null)
  const studentId = typeof body?.studentId === 'string' ? body.studentId : ''
  const dateParam = typeof body?.date === 'string' ? body.date : ''
  const status = typeof body?.status === 'string' ? body.status : ''

  if (!studentId || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'A student and a valid status are required.' }, { status: 400 })
  }
  const dayStart = parseDateKey(dateParam)
  if (!dayStart) return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })

  const student = await prisma.student.findFirst({ where: { id: studentId, academyId: user.academyId } })
  if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 })

  const record = await prisma.attendanceRecord.upsert({
    where: { studentId_date: { studentId, date: dayStart } },
    create: {
      academyId: user.academyId,
      studentId,
      classId: student.classId,
      date: dayStart,
      status: status as any,
      markedByUserId: user.id,
    },
    update: { status: status as any, markedByUserId: user.id },
  })

  return NextResponse.json({ record: { studentId: record.studentId, status: record.status } })
}
