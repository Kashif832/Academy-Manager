import bcrypt from 'bcrypt'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { getRequestId, jsonError, requireWritable } from '@/lib/http'
import { validateBody } from '@/lib/validation'
import { createStaffSchema } from '@/lib/schemas'
import { staffLimitFor } from '@/lib/tiers'
import { canManageAcademy } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

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
  const requestId = getRequestId(request)
  const user = await getSessionUser()
  if (!user) return jsonError(401, 'Not authenticated.', requestId)

  const notWritable = requireWritable(user, requestId)
  if (notWritable) return notWritable
  if (!canManageAcademy(user.role)) {
    return jsonError(403, 'Only owners and admins can add staff.', requestId)
  }

  const parsed = await validateBody(request, createStaffSchema, requestId)
  if (!parsed.ok) return parsed.response
  const fullName = parsed.data.fullName
  const email = parsed.data.email.toLowerCase()
  const phone = parsed.data.phone?.trim() || null
  const role = parsed.data.role
  const password = parsed.data.password

  const limit = staffLimitFor(user.academy.planTier)
  const activeCount = await prisma.user.count({ where: { academyId: user.academyId, isActive: true } })
  if (activeCount >= limit) {
    return jsonError(403, `Your plan allows up to ${limit} staff account${limit === 1 ? '' : 's'}. Upgrade your plan to add more.`, requestId)
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
