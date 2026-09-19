import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { canManageFinance } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { computeInvoiceStatus } from '@/lib/fees'

const VALID_METHODS = new Set(['CASH', 'BANK_TRANSFER', 'CARD', 'ONLINE'])
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  // Financial operation — owners, admins and accountants only.
  if (!canManageFinance(user.role)) {
    return NextResponse.json({ error: 'Only owners, admins and accountants can record payments.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const invoiceId = typeof body?.invoiceId === 'string' ? body.invoiceId : ''
  const studentId = typeof body?.studentId === 'string' ? body.studentId : ''
  const month = typeof body?.month === 'string' ? body.month : ''
  const amount = Number(body?.amount)
  const paymentMethod = typeof body?.paymentMethod === 'string' ? body.paymentMethod : ''
  // Optional client-supplied idempotency key: retried/double-clicked submissions
  // that carry the same key return the original payment instead of a duplicate.
  const idempotencyKey = typeof body?.idempotencyKey === 'string' && body.idempotencyKey.trim()
    ? body.idempotencyKey.trim().slice(0, 100)
    : null

  if (!invoiceId && !(studentId && month)) {
    return NextResponse.json({ error: 'An invoice, or a student and month, must be selected.' }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be a positive number.' }, { status: 400 })
  }
  if (amount > 100_000_000) {
    return NextResponse.json({ error: 'Amount is unreasonably large.' }, { status: 400 })
  }
  if (!VALID_METHODS.has(paymentMethod)) {
    return NextResponse.json({ error: 'Please choose a valid payment method.' }, { status: 400 })
  }

  // Idempotency short-circuit: if a payment with this key already exists for
  // this tenant, return it rather than creating a second one.
  if (idempotencyKey) {
    const existing = await prisma.feePayment.findFirst({
      where: { academyId: user.academyId, idempotencyKey },
      include: { invoice: true },
    })
    if (existing) {
      return NextResponse.json({
        payment: { id: existing.id, receiptNumber: existing.receiptNumber, amount: Number(existing.amount), paidAt: existing.paidAt },
        invoice: {
          id: existing.invoice.id,
          month: existing.invoice.month,
          amountDue: Number(existing.invoice.amountDue),
          amountPaid: Number(existing.invoice.amountPaid),
          balance: Number(existing.invoice.amountDue) - Number(existing.invoice.amountPaid),
          status: existing.invoice.status,
        },
        idempotent: true,
      }, { status: 200 })
    }
  }

  if (studentId || !invoiceId) {
    const monthMatch = month ? MONTH_PATTERN.exec(month) : null
    if (!invoiceId && !monthMatch) {
      return NextResponse.json({ error: 'Month must be in YYYY-MM format.' }, { status: 400 })
    }
  }

  const receiptNumber = `${user.academy.receiptPrefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`

  // All read-check-write happens inside one Serializable transaction so two
  // concurrent payments against the same invoice can never both read a stale
  // balance and overwrite each other. The invoice is (find-or-created and)
  // RE-READ inside the transaction, and the balance validated there — never
  // from a value read before the transaction began.
  try {
    const result = await prisma.$transaction(async (tx) => {
      let invoice
      if (invoiceId) {
        invoice = await tx.feeInvoice.findFirst({ where: { id: invoiceId, academyId: user.academyId } })
        if (!invoice) return { error: 'Invoice not found.', status: 404 as const }
      } else {
        const student = await tx.student.findFirst({ where: { id: studentId, academyId: user.academyId } })
        if (!student) return { error: 'Student not found.', status: 404 as const }
        const monthMatch = MONTH_PATTERN.exec(month)!
        const [, yearStr, monthStr] = monthMatch
        const dueDate = new Date(Number(yearStr), Number(monthStr) - 1, 10)
        invoice = await tx.feeInvoice.upsert({
          where: { studentId_month: { studentId, month } },
          update: {},
          create: { academyId: user.academyId, studentId, month, amountDue: student.monthlyFee, amountPaid: 0, status: 'PENDING', dueDate },
        })
      }

      const balance = Number(invoice.amountDue) - Number(invoice.amountPaid)
      if (amount > balance + 0.01) {
        return { error: `Amount exceeds the remaining balance of Rs ${Math.round(balance).toLocaleString()}.`, status: 400 as const }
      }

      const newAmountPaid = Number(invoice.amountPaid) + amount
      const newStatus = computeInvoiceStatus(newAmountPaid, Number(invoice.amountDue), invoice.dueDate)

      const payment = await tx.feePayment.create({
        data: {
          academyId: user.academyId,
          invoiceId: invoice.id,
          amount,
          paymentMethod: paymentMethod as any,
          receiptNumber,
          recordedByUserId: user.id,
          idempotencyKey,
        },
      })
      await tx.feeInvoice.update({ where: { id: invoice.id }, data: { amountPaid: newAmountPaid, status: newStatus as any } })

      return {
        ok: true as const,
        payment: { id: payment.id, receiptNumber: payment.receiptNumber, amount: Number(payment.amount), paidAt: payment.paidAt },
        invoice: {
          id: invoice.id, month: invoice.month, amountDue: Number(invoice.amountDue),
          amountPaid: newAmountPaid, balance: Number(invoice.amountDue) - newAmountPaid, status: newStatus,
        },
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    await logAudit({
      academyId: user.academyId,
      userId: user.id,
      action: 'payment.recorded',
      entityType: 'FeePayment',
      entityId: result.payment.id,
      metadata: { amount, invoiceId: result.invoice.id, receiptNumber: result.payment.receiptNumber },
    })

    return NextResponse.json({ payment: result.payment, invoice: result.invoice }, { status: 201 })
  } catch (err) {
    // A unique-constraint violation on idempotencyKey means a concurrent
    // request with the same key already created the payment — return it.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && idempotencyKey) {
      const existing = await prisma.feePayment.findFirst({ where: { academyId: user.academyId, idempotencyKey }, include: { invoice: true } })
      if (existing) {
        return NextResponse.json({
          payment: { id: existing.id, receiptNumber: existing.receiptNumber, amount: Number(existing.amount), paidAt: existing.paidAt },
          invoice: {
            id: existing.invoice.id, month: existing.invoice.month, amountDue: Number(existing.invoice.amountDue),
            amountPaid: Number(existing.invoice.amountPaid), balance: Number(existing.invoice.amountDue) - Number(existing.invoice.amountPaid), status: existing.invoice.status,
          },
          idempotent: true,
        }, { status: 200 })
      }
    }
    // Serialization failures (concurrent write conflict) — ask the client to retry.
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P2034')) {
      return NextResponse.json({ error: 'This payment could not be completed due to a concurrent update. Please try again.' }, { status: 409 })
    }
    console.error('payment.create failed', err)
    return NextResponse.json({ error: 'Could not record the payment. Please try again.' }, { status: 500 })
  }
}
