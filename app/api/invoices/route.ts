import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'

const STATUS_PRIORITY: Record<string, number> = { OVERDUE: 0, PARTIAL: 1, PENDING: 2, PAID: 3 }

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  // Optional ?month=YYYY-MM filter (indexed) and opt-in ?limit/?page pagination.
  // Both bound the result set; without them the full list is returned unchanged.
  const url = request.nextUrl
  const month = url.searchParams.get('month')?.match(/^\d{4}-\d{2}$/) ? url.searchParams.get('month')! : undefined
  const limitParam = Number(url.searchParams.get('limit'))
  const paginated = Number.isFinite(limitParam) && limitParam > 0
  const limit = paginated ? Math.min(200, Math.max(1, Math.trunc(limitParam))) : undefined
  const page = Math.max(1, Math.trunc(Number(url.searchParams.get('page')) || 1))
  const where = { academyId: user.academyId, ...(month ? { month } : {}) }
  const total = paginated ? await prisma.feeInvoice.count({ where }) : undefined

  const invoices = await prisma.feeInvoice.findMany({
    where,
    ...(paginated ? { orderBy: [{ dueDate: 'asc' as const }], skip: (page - 1) * (limit as number), take: limit } : {}),
    include: {
      student: { select: { fullName: true, parentName: true, parentPhone: true, class: { select: { name: true, section: true } } } },
      payments: { orderBy: { paidAt: 'desc' }, take: 1, select: { id: true, receiptNumber: true, paidAt: true } },
    },
  })

  const payload = invoices
    .map((invoice) => ({
      id: invoice.id,
      studentId: invoice.studentId,
      studentName: invoice.student.fullName,
      parentName: invoice.student.parentName,
      parentPhone: invoice.student.parentPhone,
      className: `${invoice.student.class.name} · ${invoice.student.class.section}`,
      month: invoice.month,
      amountDue: Number(invoice.amountDue),
      amountPaid: Number(invoice.amountPaid),
      balance: Number(invoice.amountDue) - Number(invoice.amountPaid),
      status: invoice.status,
      dueDate: invoice.dueDate,
      lastPaymentId: invoice.payments[0]?.id ?? null,
      lastReceiptNumber: invoice.payments[0]?.receiptNumber ?? null,
    }))
    .sort((a, b) => {
      const priority = (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9)
      if (priority !== 0) return priority
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })

  return NextResponse.json({
    invoices: payload,
    ...(paginated ? { pagination: { page, limit, total, totalPages: Math.ceil((total as number) / (limit as number)) } } : {}),
  })
}
