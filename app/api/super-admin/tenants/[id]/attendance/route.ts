import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/super-session'

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { id } = await params
  const todayStart = startOfDay(new Date())
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  const [totalActiveStudents, todayRecords] = await Promise.all([
    prisma.student.count({ where: { academyId: id, status: 'ACTIVE' } }),
    prisma.attendanceRecord.findMany({
      where: { academyId: id, date: { gte: todayStart, lt: tomorrowStart } },
      select: { status: true },
    }),
  ])

  const present = todayRecords.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length
  const absent = todayRecords.filter((r) => r.status === 'ABSENT').length

  return NextResponse.json({
    today: {
      totalActiveStudents,
      marked: todayRecords.length,
      present,
      absent,
      notMarked: Math.max(0, totalActiveStudents - todayRecords.length),
    },
  })
}
