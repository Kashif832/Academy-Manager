import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isPremiumTier } from '@/lib/site-content'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { getRequestId, jsonError } from '@/lib/http'
import { readJson, validate } from '@/lib/validation'
import { publicInquirySchema } from '@/lib/schemas'

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const requestId = getRequestId(request)

  // Anti-abuse: throttle public submissions per IP and per academy.
  const ip = clientIp(request)
  const byIp = await rateLimit(`inquiry:ip:${ip}`, 5, 60_000)
  const bySlug = await rateLimit(`inquiry:slug:${slug}`, 30, 60_000)
  if (!byIp.ok || !bySlug.ok) {
    const retry = Math.max(!byIp.ok ? byIp.retryAfterSeconds : 0, !bySlug.ok ? bySlug.retryAfterSeconds : 0)
    return NextResponse.json({ error: 'Too many submissions. Please try again shortly.' }, { status: 429, headers: { 'Retry-After': String(retry) } })
  }

  const academy = await prisma.academy.findUnique({ where: { slug } })
  if (!academy || !isPremiumTier(academy.planTier)) {
    return NextResponse.json({ error: 'This site is not available.' }, { status: 404 })
  }

  const body = await readJson(request)
  if (body === null) return jsonError(400, 'Request body must be valid JSON and within size limits.', requestId)

  // Honeypot: bots fill hidden fields. Checked BEFORE schema validation so a
  // filled honeypot returns a fake success (bot believes it worked, no record,
  // no 400 that would reveal the trap).
  const honeypot = typeof (body as { website?: unknown }).website === 'string' ? (body as { website: string }).website.trim() : ''
  if (honeypot) {
    return NextResponse.json({ ok: true }, { status: 201 })
  }

  const parsed = validate(publicInquirySchema, body, requestId)
  if (!parsed.ok) return parsed.response
  const name = parsed.data.name
  const phone = parsed.data.phone
  const email = parsed.data.email?.trim() || null
  const message = parsed.data.message?.trim() || null
  const studentName = parsed.data.studentName?.trim() || null
  const requestedClassId = parsed.data.interestedClassId || null
  const source = parsed.data.source?.trim() || 'Website'

  let interestedClassId: string | null = null
  if (requestedClassId) {
    const cls = await prisma.class.findFirst({ where: { id: requestedClassId, academyId: academy.id, publicVisible: true } })
    if (cls) interestedClassId = cls.id
  }

  // Duplicate suppression: same name+phone at the same academy within 5 minutes
  // is treated as a resubmit (return success, don't create a second lead).
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000)
  const dup = await prisma.siteInquiry.findFirst({
    where: { academyId: academy.id, name, phone, createdAt: { gte: fiveMinutesAgo } },
    select: { id: true },
  })
  if (dup) {
    return NextResponse.json({ ok: true, deduped: true }, { status: 201 })
  }

  await prisma.siteInquiry.create({
    data: { academyId: academy.id, name, phone, email, message, studentName, interestedClassId, source },
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
