// Pure, deterministic fee/invoice logic. Kept dependency-free so it can be
// unit-tested in isolation and reused by the payments route.

export type InvoiceStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE'

// Deterministic invoice status from paid/due amounts and the due date.
// PAID once the full amount (or more) is covered; PARTIAL for any positive
// part-payment; otherwise OVERDUE if past due, else PENDING.
export function computeInvoiceStatus(amountPaid: number, amountDue: number, dueDate: Date, now: Date = new Date()): InvoiceStatus {
  if (amountPaid >= amountDue) return 'PAID'
  if (amountPaid > 0) return 'PARTIAL'
  return dueDate.getTime() < now.getTime() ? 'OVERDUE' : 'PENDING'
}

// Remaining balance on an invoice, never negative.
export function invoiceBalance(amountDue: number, amountPaid: number): number {
  return Math.max(0, amountDue - amountPaid)
}

// New invoice state after reversing (VOID/REFUND) a payment of `amount`. The
// paid total is reduced (never below zero) and the status recomputed. Pure, so
// the financial-lifecycle arithmetic is regression-tested without a database.
export function reversedInvoiceState(
  amountPaid: number,
  amount: number,
  amountDue: number,
  dueDate: Date,
  now: Date = new Date(),
): { amountPaid: number; status: InvoiceStatus } {
  const next = Math.max(0, amountPaid - amount)
  return { amountPaid: next, status: computeInvoiceStatus(next, amountDue, dueDate, now) }
}

// Whether a proposed payment amount is acceptable against the current balance.
// A tiny epsilon tolerates floating-point rounding on the final payment.
export function isPaymentAmountValid(amount: number, amountDue: number, amountPaid: number): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return false
  const balance = amountDue - amountPaid
  return amount <= balance + 0.01
}
