import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'
import { setSessionCookie } from '@/lib/session'
import { rateLimit, clientIp, safeKeyPart } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  // Brute-force protection: cap attempts per IP and per targeted email.
  const ip = clientIp(request)
  const byIp = await rateLimit(`login:ip:${ip}`, 10, 60_000)
  const byEmail = await rateLimit(`login:email:${safeKeyPart(email)}`, 5, 60_000)
  if (!byIp.ok || !byEmail.ok) {
    const retry = Math.max(!byIp.ok ? byIp.retryAfterSeconds : 0, !byEmail.ok ? byEmail.retryAfterSeconds : 0)
    return NextResponse.json({ error: 'Too many attempts. Please wait a moment and try again.' }, { status: 429, headers: { 'Retry-After': String(retry) } })
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { academy: true } })
  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash)
  if (!passwordMatches) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  if (user.academy.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'This academy account is inactive. Please contact support.' }, { status: 403 })
  }

  await setSessionCookie(user.id, user.sessionEpoch)

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
    academy: {
      id: user.academy.id,
      name: user.academy.name,
      slug: user.academy.slug,
      planTier: user.academy.planTier,
      trialEndsAt: user.academy.trialEndsAt,
      reminderTemplate: user.academy.reminderTemplate,
    },
  })
}
