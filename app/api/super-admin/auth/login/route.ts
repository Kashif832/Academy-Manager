import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'
import { setSuperAdminSessionCookie } from '@/lib/super-session'
import { logAudit } from '@/lib/audit'
import { rateLimit, clientIp, safeKeyPart } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  // Stricter brute-force protection for the privileged platform login.
  const ip = clientIp(request)
  const byIp = await rateLimit(`superlogin:ip:${ip}`, 5, 60_000)
  const byEmail = await rateLimit(`superlogin:email:${safeKeyPart(email)}`, 5, 60_000)
  if (!byIp.ok || !byEmail.ok) {
    const retry = Math.max(!byIp.ok ? byIp.retryAfterSeconds : 0, !byEmail.ok ? byEmail.retryAfterSeconds : 0)
    return NextResponse.json({ error: 'Too many attempts. Please wait a moment and try again.' }, { status: 429, headers: { 'Retry-After': String(retry) } })
  }

  const superAdmin = await prisma.superAdmin.findUnique({ where: { email } })
  if (!superAdmin || !superAdmin.isActive) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  const passwordMatches = await bcrypt.compare(password, superAdmin.passwordHash)
  if (!passwordMatches) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  await setSuperAdminSessionCookie(superAdmin.id)

  await logAudit({
    superAdminId: superAdmin.id,
    action: 'super_admin.login',
    entityType: 'SuperAdmin',
    entityId: superAdmin.id,
  })

  return NextResponse.json({
    superAdmin: { id: superAdmin.id, email: superAdmin.email, fullName: superAdmin.fullName },
  })
}
