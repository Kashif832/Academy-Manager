import { z, zId, zNonEmpty, zOptionalStr, zMonth, zPhone, zEmail, zAmount } from '@/lib/validation'

// Centralized request schemas for mutation/public endpoints. Kept in one place
// so the validation contract is consistent and unit-testable.

export const paymentMethod = z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'ONLINE'])
export const studentStatus = z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED'])
export const attendanceStatus = z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
export const staffRole = z.enum(['ADMIN', 'TEACHER', 'ACCOUNTANT'])
export const leadStatus = z.enum(['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'APPLICATION', 'ACCEPTED', 'ENROLLED', 'LOST'])

// ── Payments ─────────────────────────────────────────────────────────────────
export const recordPaymentSchema = z
  .object({
    invoiceId: zId.optional(),
    studentId: zId.optional(),
    month: zMonth.optional(),
    amount: zAmount,
    paymentMethod,
    idempotencyKey: z.string().trim().max(100).optional().nullable(),
  })
  .refine((d) => d.invoiceId || (d.studentId && d.month), {
    message: 'either invoiceId, or studentId and month, is required',
  })

export const reversePaymentSchema = z.object({
  action: z.enum(['VOID', 'REFUND']),
  reason: z.string().trim().max(500).optional().nullable(),
})

// ── Students ─────────────────────────────────────────────────────────────────
export const createStudentSchema = z.object({
  fullName: zNonEmpty(120),
  parentName: zNonEmpty(120),
  parentPhone: zPhone,
  parentEmail: zEmail.optional().nullable(),
  classId: zId,
  monthlyFee: zAmount,
  dateOfBirth: z.string().optional().nullable(),
  admissionDate: z.string().optional().nullable(),
  status: studentStatus.optional(),
})

export const updateStudentSchema = createStudentSchema.partial()

// ── Classes ──────────────────────────────────────────────────────────────────
export const createClassSchema = z.object({
  name: zNonEmpty(80),
  section: zNonEmpty(40),
  monthlyFee: zAmount,
  teacherId: zId.optional().nullable(),
})
export const updateClassSchema = createClassSchema.partial().extend({
  isActive: z.boolean().optional(),
})

// ── Staff ────────────────────────────────────────────────────────────────────
export const createStaffSchema = z.object({
  fullName: zNonEmpty(120),
  email: zEmail,
  password: z.string().min(6, 'must be at least 6 characters').max(200),
  role: staffRole,
  phone: zPhone.optional().nullable(),
})

// ── Attendance ───────────────────────────────────────────────────────────────
export const markAttendanceSchema = z.object({
  classId: zId,
  date: z.string().min(8, 'is required'),
  records: z
    .array(z.object({ studentId: zId, status: attendanceStatus }))
    .min(1, 'at least one record is required')
    .max(1000, 'too many records'),
})

// ── Public inquiry ───────────────────────────────────────────────────────────
export const publicInquirySchema = z.object({
  name: zNonEmpty(120),
  phone: zPhone,
  email: zEmail.optional().nullable(),
  message: zOptionalStr(2000),
  // honeypot — must be empty; bots fill it.
  website: z.string().max(0, 'unexpected value').optional().or(z.literal('')),
})

// ── Plan upgrade request ─────────────────────────────────────────────────────
export const planRequestSchema = z.object({
  requestedTier: z.enum(['BASIC', 'PRO']),
  note: zOptionalStr(1000),
})
