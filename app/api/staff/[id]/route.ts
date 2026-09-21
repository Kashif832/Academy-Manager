import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { requireWritable } from '@/lib/http'
import { staffLimitFor } from '@/lib/tiers'
import { canManageAcademy } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

const STAFF_SELECT = { id: true, fullName: true, email: true, phone: true, role: true, isActive: true, createdAt: true, showOnWebsite: true, publicTitle: true, publicBio: true, publicPhotoUrl: true } as const

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const notWritable = requireWritable(user)
  if (notWritable) return notWritable
  if (!canManageAcademy(user.role)) {
    return NextResponse.json({ error: 'Only owners and admins can manage staff.' }, { status: 403 })
  }

  const { id } = await params
  const target = await prisma.user.findFirst({ where: { id, academyId: user.academyId } })
  if (!target) return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })

  const data: Record<string, unknown> = {}
  let action = 'staff.updated'

  if ('isActive' in body) {
    if (target.role === 'OWNER') {
      return NextResponse.json({ error: "The academy owner's account can't be deactivated." }, { status: 400 })
    }
    const isActive = Boolean(body.isActive)
    if (isActive) {
      const limit = staffLimitFor(user.academy.planTier)
      const activeCount = await prisma.user.count({ where: { academyId: user.academyId, isActive: true } })
      if (activeCount >= limit) {
        return NextResponse.json({ error: `Your plan allows up to ${limit} staff account${limit === 1 ? '' : 's'}. Upgrade your plan to reactivate more.` }, { status: 403 })
      }
    }
    data.isActive = isActive
    action = isActive ? 'staff.reactivated' : 'staff.deactivated'
  }

  // Public faculty profile — deliberately excludes email/phone/salary/HR fields.
  if ('showOnWebsite' in body) data.showOnWebsite = Boolean(body.showOnWebsite)
  if ('publicTitle' in body) data.publicTitle = typeof body.publicTitle === 'string' && body.publicTitle.trim() ? body.publicTitle.trim().slice(0, 80) : null
  if ('publicBio' in body) data.publicBio = typeof body.publicBio === 'string' && body.publicBio.trim() ? body.publicBio.trim().slice(0, 500) : null
  if ('publicPhotoUrl' in body) data.publicPhotoUrl = typeof body.publicPhotoUrl === 'string' && body.publicPhotoUrl.trim() ? body.publicPhotoUrl.trim().slice(0, 500) : null

  const updated = await prisma.user.update({ where: { id }, data, select: STAFF_SELECT })

  await logAudit({
    academyId: user.academyId,
    userId: user.id,
    action,
    entityType: 'User',
    entityId: updated.id,
    metadata: { fullName: updated.fullName, email: updated.email },
  })

  return NextResponse.json({ staff: updated })
}
