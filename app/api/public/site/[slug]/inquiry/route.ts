import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isPremiumTier } from '@/lib/site-content'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

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

  const body = await request.json().catch(() => null)

  // Honeypot: bots fill hidden fields. A filled honeypot returns a fake success
  // so the bot believes it succeeded, without creating a record.
  const honeypot = typeof body?.website === 'string' ? body.website.trim() : ''
  if (honeypot) {
    return NextResponse.json({ ok: true }, { status: 201 })
  }

  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : ''
  const phone = typeof body?.phone === 'string' ? body.phone.trim().slice(0, 40) : ''
  const email = typeof body?.email === 'string' && body.email.trim() ? body.email.trim().slice(0, 160) : null
  const message = typeof body?.message === 'string' && body.message.trim() ? body.message.trim().slice(0, 1000) : null
  const studentName = typeof body?.studentName === 'string' && body.studentName.trim() ? body.studentName.trim().slice(0, 120) : null
  const requestedClassId = typeof body?.interestedClassId === 'string' && body.interestedClassId ? body.interestedClassId : null
  const source = typeof body?.source === 'string' && body.source.trim() ? body.source.trim().slice(0, 40) : 'Website'

  if (!name || !phone) {
    return NextResponse.json({ error: 'Name and phone are required.' }, { status: 400 })
  }
  // Basic phone sanity check (digits, spaces and common separators only).
  if (!/^[\d\s()+\-]{6,40}$/.test(phone)) {
    return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

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
