import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'

const STATUS_PRIORITY: Record<string, number> = { OVERDUE: 0, PARTIAL: 1, PENDING: 2, PAID: 3 }

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const invoices = await prisma.feeInvoice.findMany({
    where: { academyId: user.academyId },
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

  return NextResponse.json({ invoices: payload })
}
