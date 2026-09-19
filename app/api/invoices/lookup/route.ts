import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'

const MONTH_PATTERN = /^\d{4}-\d{2}$/

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const studentId = request.nextUrl.searchParams.get('studentId') ?? ''
  const month = request.nextUrl.searchParams.get('month') ?? ''
  if (!studentId || !MONTH_PATTERN.test(month)) {
    return NextResponse.json({ error: 'A student and a valid month (YYYY-MM) are required.' }, { status: 400 })
  }

  const student = await prisma.student.findFirst({ where: { id: studentId, academyId: user.academyId } })
  if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 })

  const invoice = await prisma.feeInvoice.findUnique({ where: { studentId_month: { studentId, month } } })

  if (invoice) {
    return NextResponse.json({
      exists: true,
      invoiceId: invoice.id,
      amountDue: Number(invoice.amountDue),
      amountPaid: Number(invoice.amountPaid),
      balance: Number(invoice.amountDue) - Number(invoice.amountPaid),
      status: invoice.status,
    })
  }

  const monthlyFee = Number(student.monthlyFee)
  return NextResponse.json({
    exists: false,
    invoiceId: null,
    amountDue: monthlyFee,
    amountPaid: 0,
    balance: monthlyFee,
    status: 'PENDING',
  })
}
