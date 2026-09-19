import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'

const UNPAID_STATUSES = ['PENDING', 'PARTIAL', 'OVERDUE'] as const
const FEE_PRIORITY: Record<string, number> = { OVERDUE: 0, PARTIAL: 1, PENDING: 2, PAID: 3 }

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function percentage(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : null
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const academyId = user.academyId
  const now = new Date()
  const todayStart = startOfDay(now)
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
  const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth() - 1, 1)

  const sevenDaysAgoStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)

  const [
    totalStudents,
    studentsAddedThisMonth,
    feesThisMonthAgg,
    feesLastMonthAgg,
    pendingInvoices,
    todaysAttendance,
    recentStudents,
    newEnrollmentsThisWeek,
    weekAttendanceRecords,
    classCount,
    attendanceEverCount,
    paymentEverCount,
    billedThisMonthAgg,
  ] = await Promise.all([
    prisma.student.count({ where: { academyId, status: 'ACTIVE' } }),
    // "Added this month" reflects enrollment (admissionDate), not record-creation timestamp.
    prisma.student.count({ where: { academyId, status: 'ACTIVE', admissionDate: { gte: thisMonthStart } } }),
    prisma.feePayment.aggregate({
      where: { academyId, paidAt: { gte: thisMonthStart } },
      _sum: { amount: true },
    }),
    prisma.feePayment.aggregate({
      where: { academyId, paidAt: { gte: lastMonthStart, lt: thisMonthStart } },
      _sum: { amount: true },
    }),
    prisma.feeInvoice.findMany({
      where: { academyId, status: { in: [...UNPAID_STATUSES] } },
      select: { amountDue: true, amountPaid: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { academyId, date: { gte: todayStart, lt: tomorrowStart } },
      select: { status: true },
    }),
    prisma.student.findMany({
      where: { academyId },
      orderBy: { admissionDate: 'desc' },
      take: 12,
      include: {
        class: { select: { name: true, section: true } },
        feeInvoices: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, month: true, amountDue: true, amountPaid: true },
        },
        attendanceRecords: { select: { status: true }, orderBy: { date: 'desc' }, take: 30 },
      },
    }),
    prisma.student.count({ where: { academyId, status: 'ACTIVE', admissionDate: { gte: weekAgo } } }),
    prisma.attendanceRecord.findMany({
      where: { academyId, date: { gte: sevenDaysAgoStart, lt: tomorrowStart } },
      select: { date: true, status: true },
    }),
    prisma.class.count({ where: { academyId } }),
    prisma.attendanceRecord.count({ where: { academyId } }),
    prisma.feePayment.count({ where: { academyId } }),
    // Billed-this-month is keyed by the invoice's own `month` field (e.g. "2026-09"),
    // matching the same convention students/fees invoices are created with.
    prisma.feeInvoice.aggregate({
      where: { academyId, month: monthKey(now) },
      _sum: { amountDue: true, amountPaid: true },
    }),
  ])

  const feesThisMonth = Number(feesThisMonthAgg._sum.amount ?? 0)
  const feesLastMonth = Number(feesLastMonthAgg._sum.amount ?? 0)
  const feesChangePct = feesLastMonth > 0 ? ((feesThisMonth - feesLastMonth) / feesLastMonth) * 100 : null

  const pendingAmount = pendingInvoices.reduce(
    (sum, invoice) => sum + (Number(invoice.amountDue) - Number(invoice.amountPaid)),
    0,
  )

  // Present/absent/late/excused mirror the exact buckets the Attendance module itself
  // uses (see AttendanceModule's `counts`), so the dashboard never invents its own
  // classification. The attendance rate is weighted against ALL active students
  // (not just those marked so far today) so a partially-marked day is never reported
  // as if every student had been accounted for.
  const presentOnlyToday = todaysAttendance.filter((r) => r.status === 'PRESENT').length
  const lateToday = todaysAttendance.filter((r) => r.status === 'LATE').length
  const absentToday = todaysAttendance.filter((r) => r.status === 'ABSENT').length
  const excusedToday = todaysAttendance.filter((r) => r.status === 'EXCUSED').length
  const attendanceMarkedToday = todaysAttendance.length
  const attendanceNotMarkedToday = Math.max(0, totalStudents - attendanceMarkedToday)
  const presentToday = presentOnlyToday + lateToday
  const attendanceRateToday = totalStudents > 0 ? (presentToday / totalStudents) * 100 : null
  const attendanceCoveragePct = percentage(attendanceMarkedToday, totalStudents)

  const billedThisMonth = Number(billedThisMonthAgg._sum.amountDue ?? 0)
  const collectedOfBilledThisMonth = Number(billedThisMonthAgg._sum.amountPaid ?? 0)
  const collectionRatePct = billedThisMonth > 0 ? (collectedOfBilledThisMonth / billedThisMonth) * 100 : null

  const recentStudentsPayload = recentStudents
    .map((student) => {
      const invoice = student.feeInvoices[0]
      const feeStatus = invoice?.status ?? 'PENDING'
      const attendanceTotal = student.attendanceRecords.length
      const attendancePresent = student.attendanceRecords.filter(
        (r) => r.status === 'PRESENT' || r.status === 'LATE',
      ).length
      return {
        id: student.id,
        name: student.fullName,
        className: `${student.class.name} · ${student.class.section}`,
        section: student.class.section,
        feeStatus,
        feeMonth: invoice?.month ?? null,
        balance: invoice ? Number(invoice.amountDue) - Number(invoice.amountPaid) : 0,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        parentEmail: student.parentEmail,
        admissionDate: student.admissionDate,
        attendanceRate: attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : null,
        setup: {
          feePaid: feeStatus === 'PAID',
          attendanceMarked: attendanceTotal > 0,
          parentEmailOnFile: Boolean(student.parentEmail),
          dateOfBirthOnFile: Boolean(student.dateOfBirth),
        },
      }
    })
    .sort((a, b) => {
      const priority = (FEE_PRIORITY[a.feeStatus] ?? 9) - (FEE_PRIORITY[b.feeStatus] ?? 9)
      if (priority !== 0) return priority
      return new Date(b.admissionDate).getTime() - new Date(a.admissionDate).getTime()
    })

  const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const dayBuckets = new Map<string, { present: number; total: number }>()
  for (let i = 0; i < 7; i++) {
    const day = new Date(sevenDaysAgoStart.getTime() + i * 24 * 60 * 60 * 1000)
    dayBuckets.set(dateKey(day), { present: 0, total: 0 })
  }
  for (const record of weekAttendanceRecords) {
    const bucket = dayBuckets.get(dateKey(new Date(record.date)))
    if (!bucket) continue
    bucket.total += 1
    if (record.status === 'PRESENT' || record.status === 'LATE') bucket.present += 1
  }
  const weeklyAttendance = [...dayBuckets.entries()].map(([date, { present, total }]) => ({
    date,
    pct: total > 0 ? Math.round((present / total) * 100) : null,
  }))

  const healthChecks = [
    { key: 'students', done: totalStudents > 0 },
    { key: 'classes', done: classCount > 0 },
    { key: 'attendance', done: attendanceEverCount > 0 },
    { key: 'payments', done: paymentEverCount > 0 },
    { key: 'phone', done: Boolean(user.academy.phone) },
    { key: 'address', done: Boolean(user.academy.address) },
  ]
  const health = {
    percent: Math.round((healthChecks.filter((c) => c.done).length / healthChecks.length) * 100),
    missing: healthChecks.filter((c) => !c.done).map((c) => c.key),
  }

  return NextResponse.json({
    stats: {
      totalStudents,
      studentsAddedThisMonth,
      feesThisMonth,
      feesChangePct,
      attendanceRateToday,
      presentToday,
      absentToday,
      lateToday,
      excusedToday,
      attendanceMarkedToday,
      attendanceNotMarkedToday,
      pendingAmount,
      pendingInvoiceCount: pendingInvoices.length,
    },
    summary: {
      newEnrollmentsThisWeek,
      collectionRatePct,
      attendanceCoveragePct,
    },
    recentStudents: recentStudentsPayload,
    weeklyAttendance,
    health,
  })
}
