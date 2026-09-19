import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { tierLabel } from '@/lib/tiers'

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const academyId = user.academyId
  const now = new Date()
  const todayStart = startOfDay(now)
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
  const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
  const soon = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000)

  const [overdueCount, dueSoonCount, activeStudentCount, attendanceTodayCount, newThisWeek] = await Promise.all([
    prisma.feeInvoice.count({ where: { academyId, status: 'OVERDUE' } }),
    prisma.feeInvoice.count({
      where: { academyId, status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { gte: todayStart, lt: soon } },
    }),
    prisma.student.count({ where: { academyId, status: 'ACTIVE' } }),
    prisma.attendanceRecord.count({ where: { academyId, date: { gte: todayStart, lt: tomorrowStart } } }),
    prisma.student.count({ where: { academyId, status: 'ACTIVE', admissionDate: { gte: weekAgo } } }),
  ])

  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { planTier: true, trialEndsAt: true } })
  const recentPlanRequest = await prisma.planUpgradeRequest.findFirst({
    where: { academyId, OR: [{ status: 'PENDING' }, { status: { in: ['APPROVED', 'REJECTED'] }, reviewedAt: { gte: weekAgo } }] },
    orderBy: { createdAt: 'desc' },
  })

  const notifications: Array<{ id: string; type: string; severity: 'high' | 'medium' | 'low' | 'info'; n?: number; label?: string }> = []

  if (overdueCount > 0) notifications.push({ id: 'overdue', type: 'overdueFees', severity: 'high', n: overdueCount })
  if (dueSoonCount > 0) notifications.push({ id: 'due-soon', type: 'pendingFees', severity: 'medium', n: dueSoonCount })

  if (academy?.planTier === 'TRIAL' && academy.trialEndsAt) {
    const daysLeft = Math.ceil((new Date(academy.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 7 && daysLeft >= 0) notifications.push({ id: 'trial', type: 'trialEnding', severity: 'medium', n: daysLeft })
  }

  if (activeStudentCount > 0 && attendanceTodayCount === 0) {
    notifications.push({ id: 'attendance', type: 'attendanceMissing', severity: 'low' })
  }

  if (newThisWeek > 0) notifications.push({ id: 'new-students', type: 'newStudents', severity: 'info', n: newThisWeek })

  if (recentPlanRequest) {
    if (recentPlanRequest.status === 'PENDING') {
      notifications.push({ id: 'plan-request-pending', type: 'planRequestPending', severity: 'info', label: tierLabel(recentPlanRequest.requestedTier) })
    } else if (recentPlanRequest.status === 'APPROVED') {
      notifications.push({ id: 'plan-request-approved', type: 'planRequestApproved', severity: 'medium', label: tierLabel(recentPlanRequest.requestedTier) })
    } else if (recentPlanRequest.status === 'REJECTED') {
      notifications.push({ id: 'plan-request-rejected', type: 'planRequestRejected', severity: 'low', label: tierLabel(recentPlanRequest.requestedTier) })
    }
  }

  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2, info: 3 }
  notifications.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return NextResponse.json({ notifications })
}
