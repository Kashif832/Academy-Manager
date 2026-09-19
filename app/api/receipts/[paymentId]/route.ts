import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { generateReceiptPdf } from '@/lib/pdf'

export async function GET(request: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { paymentId } = await params
  const payment = await prisma.feePayment.findFirst({
    where: { id: paymentId, academyId: user.academyId },
    include: {
      recordedBy: { select: { fullName: true } },
      invoice: {
        include: {
          student: { select: { fullName: true, parentName: true, class: { select: { name: true, section: true } } } },
        },
      },
    },
  })

  if (!payment) return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 })

  const pdf = generateReceiptPdf({
    academyName: user.academy.name,
    receiptNumber: payment.receiptNumber,
    paidAt: payment.paidAt,
    studentName: payment.invoice.student.fullName,
    className: `${payment.invoice.student.class.name} - ${payment.invoice.student.class.section}`,
    parentName: payment.invoice.student.parentName,
    month: payment.invoice.month,
    paymentMethod: payment.paymentMethod,
    amountPaid: Number(payment.amount),
    invoiceAmountDue: Number(payment.invoice.amountDue),
    invoiceAmountPaidTotal: Number(payment.invoice.amountPaid),
    invoiceBalance: Number(payment.invoice.amountDue) - Number(payment.invoice.amountPaid),
    recordedByName: payment.recordedBy.fullName,
  })

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="receipt-${payment.receiptNumber}.pdf"`,
      'Content-Length': String(pdf.length),
    },
  })
}
