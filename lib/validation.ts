import { z } from 'zod'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'

// Uniform request-validation layer built on zod, wired into the shared error
// contract (lib/http.ts). Every mutation/public endpoint should:
//   1. read the body with readJson (safe against malformed JSON + oversized payloads)
//   2. validate it with a zod schema via validate(...)
//   3. return the flattened, SAFE error via the returned NextResponse on failure
//
// Validation failures never leak zod internals, stack traces or tenant data —
// only field-level "path: message" strings the caller can act on.

const MAX_BODY_BYTES = 100_000 // reject absurd payloads before parsing

export type Validated<T> = { ok: true; data: T } | { ok: false; response: NextResponse }

// Safe JSON read: returns null on malformed JSON or an oversized body.
export async function readJson(request: Request): Promise<unknown | null> {
  const len = Number(request.headers.get('content-length') ?? '0')
  if (len > MAX_BODY_BYTES) return null
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) return null
    return text ? JSON.parse(text) : {}
  } catch {
    return null
  }
}

function flatten(err: z.ZodError): string {
  return err.issues
    .slice(0, 8)
    .map((i) => {
      const path = i.path.join('.') || 'body'
      return `${path}: ${i.message}`
    })
    .join('; ')
}

// Validate already-parsed data against a schema. On failure returns a ready
// 400 NextResponse carrying a safe, field-level message + the request id.
export function validate<T>(schema: z.ZodType<T>, data: unknown, requestId?: string): Validated<T> {
  const result = schema.safeParse(data)
  if (result.success) return { ok: true, data: result.data }
  return { ok: false, response: jsonError(400, flatten(result.error), requestId) }
}

// Read + validate in one step. Distinguishes malformed JSON (safe generic 400)
// from schema violations (field-level 400).
export async function validateBody<T>(request: Request, schema: z.ZodType<T>, requestId?: string): Promise<Validated<T>> {
  const body = await readJson(request)
  if (body === null) return { ok: false, response: jsonError(400, 'Request body must be valid JSON and within size limits.', requestId) }
  return validate(schema, body, requestId)
}

// ── Reusable field primitives ────────────────────────────────────────────────
export const zId = z.string().uuid({ message: 'must be a valid id' })
export const zNonEmpty = (max = 200) => z.string().trim().min(1, 'is required').max(max, `must be at most ${max} characters`)
export const zOptionalStr = (max = 500) => z.string().trim().max(max).optional().nullable()
export const zMonth = z.string().regex(/^\d{4}-\d{2}$/, 'must be in YYYY-MM format')
export const zPhone = z.string().trim().regex(/^[\d\s()+\-]{6,40}$/, 'must be a valid phone number')
export const zEmail = z.string().trim().email('must be a valid email').max(200)
export const zAmount = z.number({ message: 'must be a number' }).positive('must be positive').max(100_000_000, 'is unreasonably large')
export const zMoney = z.number().min(0, 'cannot be negative').max(100_000_000)
export const zIsoDate = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'must be a valid date'))

export { z }
