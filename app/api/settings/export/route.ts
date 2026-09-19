import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { canManageAcademy } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

// Full academy data export as a single JSON file — the "Data & Privacy" export
// feature. Scoped strictly to the caller's own academy.
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  if (!canManageAcademy(user.role)) {
    return NextResponse.json({ error: 'Only owners and admins can export academy data.' }, { status: 403 })
  }

  const academyId = user.academyId
  const [academy, classes, students, invoices, payments, attendance, staff] = await Promise.all([
    prisma.academy.findUnique({ where: { id: academyId } }),
    prisma.class.findMany({ where: { academyId } }),
    prisma.student.findMany({ where: { academyId } }),
    prisma.feeInvoice.findMany({ where: { academyId } }),
    prisma.feePayment.findMany({ where: { academyId } }),
    prisma.attendanceRecord.findMany({ where: { academyId } }),
    prisma.user.findMany({ where: { academyId }, select: { id: true, fullName: true, email: true, role: true, phone: true, isActive: true, createdAt: true } }),
  ])

  const payload = {
    exportedAt: new Date().toISOString(),
    academy: academy ? { id: academy.id, name: academy.name, slug: academy.slug, phone: academy.phone, address: academy.address, planTier: academy.planTier } : null,
    staff,
    classes,
    students,
    feeInvoices: invoices,
    feePayments: payments,
    attendanceRecords: attendance,
  }

  await logAudit({
    academyId,
    userId: user.id,
    action: 'settings.data_exported',
    entityType: 'Academy',
    entityId: academyId,
  })

  const json = JSON.stringify(payload, null, 2)
  const fileName = `${academy?.slug ?? 'academy'}-export-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
