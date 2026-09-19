import { describe, it, expect } from 'vitest'
import { computeInvoiceStatus, invoiceBalance, isPaymentAmountValid } from '../lib/fees'

const past = new Date('2020-01-10')
const future = new Date('2999-01-10')

describe('computeInvoiceStatus', () => {
  it('is PAID when fully paid', () => {
    expect(computeInvoiceStatus(1000, 1000, future)).toBe('PAID')
    expect(computeInvoiceStatus(1200, 1000, future)).toBe('PAID')
  })
  it('is PARTIAL when some but not all is paid', () => {
    expect(computeInvoiceStatus(400, 1000, future)).toBe('PARTIAL')
  })
  it('is PENDING when nothing paid and not yet due', () => {
    expect(computeInvoiceStatus(0, 1000, future)).toBe('PENDING')
  })
  it('is OVERDUE when nothing paid and past due', () => {
    expect(computeInvoiceStatus(0, 1000, past)).toBe('OVERDUE')
  })
})

describe('invoiceBalance', () => {
  it('returns remaining balance', () => {
    expect(invoiceBalance(1000, 300)).toBe(700)
  })
  it('never goes negative on overpayment', () => {
    expect(invoiceBalance(1000, 1200)).toBe(0)
  })
})

describe('isPaymentAmountValid', () => {
  it('accepts a payment within the balance', () => {
    expect(isPaymentAmountValid(700, 1000, 300)).toBe(true)
  })
  it('accepts exact-balance final payment', () => {
    expect(isPaymentAmountValid(700, 1000, 300)).toBe(true)
  })
  it('rejects overpayment beyond balance', () => {
    expect(isPaymentAmountValid(800, 1000, 300)).toBe(false)
  })
  it('rejects zero and negative amounts', () => {
    expect(isPaymentAmountValid(0, 1000, 0)).toBe(false)
    expect(isPaymentAmountValid(-5, 1000, 0)).toBe(false)
  })
})

import { reversedInvoiceState } from '../lib/fees'

describe('reversedInvoiceState (VOID/REFUND arithmetic)', () => {
  const future = new Date(Date.now() + 86400000)
  const past = new Date(Date.now() - 86400000)
  it('voiding the only payment returns the invoice to unpaid (PENDING before due)', () => {
    expect(reversedInvoiceState(2000, 2000, 5000, future)).toEqual({ amountPaid: 0, status: 'PENDING' })
  })
  it('voiding the only payment past due date -> OVERDUE', () => {
    expect(reversedInvoiceState(2000, 2000, 5000, past)).toEqual({ amountPaid: 0, status: 'OVERDUE' })
  })
  it('reversing one of several payments stays PARTIAL', () => {
    expect(reversedInvoiceState(4000, 1500, 5000, future)).toEqual({ amountPaid: 2500, status: 'PARTIAL' })
  })
  it('reversing a payment on a fully-paid invoice drops it below PAID', () => {
    expect(reversedInvoiceState(5000, 1000, 5000, future)).toEqual({ amountPaid: 4000, status: 'PARTIAL' })
  })
  it('never goes below zero', () => {
    expect(reversedInvoiceState(500, 1000, 5000, future).amountPaid).toBe(0)
  })
})
