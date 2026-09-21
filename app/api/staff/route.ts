import bcrypt from 'bcrypt'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { requireWritable } from '@/lib/http'
import { staffLimitFor } from '@/lib/tiers'
import { canManageAcademy } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

const ASSIGNABLE_ROLES = new Set(['ADMIN', 'TEACHER', 'ACCOUNTANT'])

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const staff = await prisma.user.findMany({
    where: { academyId: user.academyId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, fullName: true, email: true, phone: true, role: true, isActive: true, createdAt: true, showOnWebsite: true, publicTitle: true, publicBio: true, publicPhotoUrl: true },
  })

  const limit = staffLimitFor(user.academy.planTier)
  const activeCount = staff.filter((s) => s.isActive).length

  return NextResponse.json({ staff, limit, activeCount, canManage: canManageAcademy(user.role) })
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const notWritable = requireWritable(user)
  if (notWritable) return notWritable
  if (!canManageAcademy(user.role)) {
    return NextResponse.json({ error: 'Only owners and admins can add staff.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const phone = typeof body?.phone === 'string' && body.phone.trim() ? body.phone.trim() : null
  const role = typeof body?.role === 'string' ? body.role : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!fullName || !email || !password) {
    return NextResponse.json({ error: 'Name, email and password are required.' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
  }
  if (!ASSIGNABLE_ROLES.has(role)) {
    return NextResponse.json({ error: 'Please choose a valid role.' }, { status: 400 })
  }

  const limit = staffLimitFor(user.academy.planTier)
  const activeCount = await prisma.user.count({ where: { academyId: user.academyId, isActive: true } })
  if (activeCount >= limit) {
    return NextResponse.json({ error: `Your plan allows up to ${limit} staff account${limit === 1 ? '' : 's'}. Upgrade your plan to add more.` }, { status: 403 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const staffUser = await prisma.user.create({
    data: { academyId: user.academyId, fullName, email, phone, role: role as any, passwordHash },
    select: { id: true, fullName: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
  })

  await logAudit({
    academyId: user.academyId,
    userId: user.id,
    action: 'staff.created',
    entityType: 'User',
    entityId: staffUser.id,
    metadata: { fullName: staffUser.fullName, email: staffUser.email, role: staffUser.role },
  })

  return NextResponse.json({ staff: staffUser }, { status: 201 })
}
