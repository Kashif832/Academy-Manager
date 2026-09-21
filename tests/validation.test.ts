import { describe, it, expect } from 'vitest'
import {
  recordPaymentSchema, reversePaymentSchema, createStudentSchema, createClassSchema,
  createStaffSchema, markAttendanceSchema, publicInquirySchema,
} from '../lib/schemas'

const UUID = '11111111-1111-4111-8111-111111111111'

describe('payment validation', () => {
  it('accepts a valid invoice payment', () => {
    expect(recordPaymentSchema.safeParse({ invoiceId: UUID, amount: 100, paymentMethod: 'CASH' }).success).toBe(true)
  })
  it('rejects a negative amount', () => {
    expect(recordPaymentSchema.safeParse({ invoiceId: UUID, amount: -5, paymentMethod: 'CASH' }).success).toBe(false)
  })
  it('rejects an unreasonably large amount', () => {
    expect(recordPaymentSchema.safeParse({ invoiceId: UUID, amount: 1e12, paymentMethod: 'CASH' }).success).toBe(false)
  })
  it('rejects an invalid payment method', () => {
    expect(recordPaymentSchema.safeParse({ invoiceId: UUID, amount: 100, paymentMethod: 'CRYPTO' }).success).toBe(false)
  })
  it('rejects when neither invoiceId nor studentId+month provided', () => {
    expect(recordPaymentSchema.safeParse({ amount: 100, paymentMethod: 'CASH' }).success).toBe(false)
  })
  it('rejects a non-uuid invoiceId', () => {
    expect(recordPaymentSchema.safeParse({ invoiceId: 'abc', amount: 100, paymentMethod: 'CASH' }).success).toBe(false)
  })
})

describe('reverse payment validation', () => {
  it('accepts VOID/REFUND', () => {
    expect(reversePaymentSchema.safeParse({ action: 'VOID' }).success).toBe(true)
    expect(reversePaymentSchema.safeParse({ action: 'REFUND', reason: 'x' }).success).toBe(true)
  })
  it('rejects an unknown action', () => {
    expect(reversePaymentSchema.safeParse({ action: 'DELETE' }).success).toBe(false)
  })
})

describe('student validation', () => {
  it('accepts a valid student', () => {
    expect(createStudentSchema.safeParse({ fullName: 'A', parentName: 'B', parentPhone: '0300-1234567', classId: UUID, monthlyFee: 1000 }).success).toBe(true)
  })
  it('rejects empty name / bad phone / bad classId', () => {
    expect(createStudentSchema.safeParse({ fullName: '', parentName: 'B', parentPhone: '0300-1234567', classId: UUID, monthlyFee: 1000 }).success).toBe(false)
    expect(createStudentSchema.safeParse({ fullName: 'A', parentName: 'B', parentPhone: '!!', classId: UUID, monthlyFee: 1000 }).success).toBe(false)
    expect(createStudentSchema.safeParse({ fullName: 'A', parentName: 'B', parentPhone: '0300-1234567', classId: 'x', monthlyFee: 1000 }).success).toBe(false)
  })
})

describe('class / staff / attendance validation', () => {
  it('class requires name, section, positive fee', () => {
    expect(createClassSchema.safeParse({ name: 'G1', section: 'A', monthlyFee: 500 }).success).toBe(true)
    expect(createClassSchema.safeParse({ name: 'G1', section: 'A', monthlyFee: 0 }).success).toBe(false)
  })
  it('staff enforces email, min password length and role enum', () => {
    expect(createStaffSchema.safeParse({ fullName: 'T', email: 'a@b.com', password: 'secret1', role: 'TEACHER' }).success).toBe(true)
    expect(createStaffSchema.safeParse({ fullName: 'T', email: 'nope', password: 'secret1', role: 'TEACHER' }).success).toBe(false)
    expect(createStaffSchema.safeParse({ fullName: 'T', email: 'a@b.com', password: '123', role: 'TEACHER' }).success).toBe(false)
    expect(createStaffSchema.safeParse({ fullName: 'T', email: 'a@b.com', password: 'secret1', role: 'OWNER' }).success).toBe(false)
  })
  it('attendance requires a valid student, date and status enum', () => {
    expect(markAttendanceSchema.safeParse({ studentId: UUID, date: '2026-09-20', status: 'PRESENT' }).success).toBe(true)
    expect(markAttendanceSchema.safeParse({ studentId: 'x', date: '2026-09-20', status: 'PRESENT' }).success).toBe(false)
    expect(markAttendanceSchema.safeParse({ studentId: UUID, date: '2026-09-20', status: 'MAYBE' }).success).toBe(false)
  })
})

describe('public inquiry validation (fields)', () => {
  it('accepts a valid inquiry', () => {
    expect(publicInquirySchema.safeParse({ name: 'Parent', phone: '0300-1234567', website: '' }).success).toBe(true)
  })
  it('requires a name and a valid phone', () => {
    expect(publicInquirySchema.safeParse({ name: '', phone: '0300-1234567' }).success).toBe(false)
    expect(publicInquirySchema.safeParse({ name: 'Parent', phone: '!!' }).success).toBe(false)
  })
  it('accepts a filled honeypot at the schema level (the route traps bots, not the schema)', () => {
    expect(publicInquirySchema.safeParse({ name: 'Parent', phone: '0300-1234567', website: 'http://spam' }).success).toBe(true)
  })
})
