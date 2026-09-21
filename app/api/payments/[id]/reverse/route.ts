import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { canManageFinance } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { computeInvoiceStatus } from '@/lib/fees'
import { getRequestId, jsonError, requireWritable } from '@/lib/http'
import { validateBody } from '@/lib/validation'
import { reversePaymentSchema } from '@/lib/schemas'

// Reverse a payment: VOID (recorded in error) or REFUND (money returned). The
// original FeePayment is preserved for history — its status flips and its
// effect on the invoice balance is undone. Authorized (finance roles only),
// tenant-scoped, atomic (Serializable), idempotent and audited.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request)
  const user = await getSessionUser()
  if (!user) return jsonError(401, 'Not authenticated.', requestId)

  const notWritable = requireWritable(user, requestId)
  if (notWritable) return notWritable
  if (!canManageFinance(user.role)) {
    return jsonError(403, 'Only owners, admins and accountants can reverse payments.', requestId)
  }

  const { id } = await params
  const parsed = await validateBody(request, reversePaymentSchema, requestId)
  if (!parsed.ok) return parsed.response
  const action = parsed.data.action
  const reason = parsed.data.reason?.trim().slice(0, 500) ?? null
  const targetStatus = action === 'VOID' ? 'VOID' : 'REFUNDED'

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Tenant-scoped lookup — a cross-tenant id is indistinguishable from missing.
      const payment = await tx.feePayment.findFirst({ where: { id, academyId: user.academyId }, include: { invoice: true } })
      if (!payment) return { ok: false as const, error: 'Payment not found.', status: 404 }

      if (payment.status !== 'COMPLETED') {
        // Idempotent: re-requesting the same reversal is a success, not an error.
        if (payment.status === targetStatus) return { ok: true as const, idempotent: true, payment, invoice: payment.invoice }
        return { ok: false as const, error: `This payment has already been ${payment.status.toLowerCase()}.`, status: 409 }
      }

      const newAmountPaid = Math.max(0, Number(payment.invoice.amountPaid) - Number(payment.amount))
      const newStatus = computeInvoiceStatus(newAmountPaid, Number(payment.invoice.amountDue), payment.invoice.dueDate)

      const updatedPayment = await tx.feePayment.update({
        where: { id: payment.id },
        data: { status: targetStatus, reversedAt: new Date(), reversedByUserId: user.id, reversalReason: reason },
      })
      const updatedInvoice = await tx.feeInvoice.update({
        where: { id: payment.invoiceId },
        data: { amountPaid: newAmountPaid, status: newStatus as Prisma.FeeInvoiceUpdateInput['status'] },
      })
      return { ok: true as const, idempotent: false, payment: updatedPayment, invoice: updatedInvoice }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    if (!result.ok) return jsonError(result.status, result.error, requestId)

    if (!result.idempotent) {
      await logAudit({
        academyId: user.academyId,
        userId: user.id,
        action: action === 'VOID' ? 'payment.voided' : 'payment.refunded',
        entityType: 'FeePayment',
        entityId: result.payment.id,
        metadata: { amount: Number(result.payment.amount), invoiceId: result.invoice.id, reason, receiptNumber: result.payment.receiptNumber },
      })
    }

    return NextResponse.json(
      {
        payment: { id: result.payment.id, status: result.payment.status, receiptNumber: result.payment.receiptNumber, amount: Number(result.payment.amount) },
        invoice: {
          id: result.invoice.id, amountDue: Number(result.invoice.amountDue), amountPaid: Number(result.invoice.amountPaid),
          balance: Number(result.invoice.amountDue) - Number(result.invoice.amountPaid), status: result.invoice.status,
        },
        ...(result.idempotent ? { idempotent: true } : {}),
      },
      { status: 200, headers: { 'x-request-id': requestId } },
    )
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
      return jsonError(409, 'This reversal could not be completed due to a concurrent update. Please try again.', requestId)
    }
    return jsonError(500, 'Could not reverse the payment. Please try again.', requestId)
  }
}
