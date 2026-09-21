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

// ── Attendance (single-record upsert) ────────────────────────────────────────
export const markAttendanceSchema = z.object({
  studentId: zId,
  date: z.string().min(8, 'is required'),
  status: attendanceStatus,
})

// ── Change password ──────────────────────────────────────────────────────────
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'is required'),
  newPassword: z.string().min(6, 'must be at least 6 characters').max(200),
})

// ── Public inquiry ───────────────────────────────────────────────────────────
export const publicInquirySchema = z.object({
  name: zNonEmpty(120),
  phone: zPhone,
  email: zEmail.optional().nullable(),
  message: zOptionalStr(1000),
  studentName: zOptionalStr(120),
  interestedClassId: zId.optional().nullable(),
  source: zOptionalStr(40),
  // Honeypot: accepted by the schema (any string) so a filled value is NOT
  // rejected here — the route silently returns a fake success for bots instead
  // of a 400 that would reveal the trap.
  website: z.string().max(200).optional(),
})

// ── Plan upgrade request ─────────────────────────────────────────────────────
// Accepts any valid tier; the route enforces the upgrade-only / same-tier rules.
export const planRequestSchema = z.object({
  requestedTier: z.enum(['TRIAL', 'BASIC', 'PRO']),
  note: zOptionalStr(1000),
})
