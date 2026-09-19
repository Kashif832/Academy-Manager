import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/super-session'
import { logAudit } from '@/lib/audit'

const VALID_TIERS = new Set(['TRIAL', 'BASIC', 'PRO'])

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export async function GET() {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const academies = await prisma.academy.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      users: { where: { role: 'OWNER' }, take: 1, select: { fullName: true, email: true } },
      _count: { select: { students: true, users: true } },
    },
  })

  return NextResponse.json({
    tenants: academies.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      planTier: a.planTier,
      status: a.status,
      ownerName: a.users[0]?.fullName ?? null,
      ownerEmail: a.users[0]?.email ?? null,
      studentCount: a._count.students,
      userCount: a._count.users,
      createdAt: a.createdAt,
    })),
  })
}

export async function POST(request: NextRequest) {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const ownerName = typeof body?.ownerName === 'string' ? body.ownerName.trim() : ''
  const ownerEmail = typeof body?.ownerEmail === 'string' ? body.ownerEmail.trim().toLowerCase() : ''
  const ownerPassword = typeof body?.ownerPassword === 'string' ? body.ownerPassword : ''
  const planTier = typeof body?.planTier === 'string' ? body.planTier : ''
  const phone = typeof body?.phone === 'string' && body.phone.trim() ? body.phone.trim() : null
  const address = typeof body?.address === 'string' && body.address.trim() ? body.address.trim() : null

  if (!name || !ownerName || !ownerEmail || !ownerPassword || !planTier) {
    return NextResponse.json({ error: 'Academy name, owner name, owner email, owner password and plan are required.' }, { status: 400 })
  }
  if (!VALID_TIERS.has(planTier)) {
    return NextResponse.json({ error: 'Invalid plan tier.' }, { status: 400 })
  }
  if (ownerPassword.length < 6) {
    return NextResponse.json({ error: 'Owner password must be at least 6 characters.' }, { status: 400 })
  }

  const baseSlug = slugify(name) || `academy-${Date.now()}`
  let slug = baseSlug
  let suffix = 1
  while (await prisma.academy.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++suffix}`
  }

  const emailTaken = await prisma.user.findUnique({ where: { email: ownerEmail } })
  if (emailTaken) {
    return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(ownerPassword, 12)

  const academy = await prisma.academy.create({
    data: {
      name,
      slug,
      phone,
      address,
      planTier: planTier as any,
      status: 'ACTIVE',
      users: {
        create: {
          email: ownerEmail,
          passwordHash,
          fullName: ownerName,
          role: 'OWNER',
        },
      },
    },
    include: { users: true },
  })

  await logAudit({
    academyId: academy.id,
    superAdminId: superAdmin.id,
    action: 'tenant.created',
    entityType: 'Academy',
    entityId: academy.id,
    metadata: { name: academy.name, planTier: academy.planTier },
  })

  return NextResponse.json({
    tenant: {
      id: academy.id,
      name: academy.name,
      slug: academy.slug,
      planTier: academy.planTier,
      status: academy.status,
      ownerName: academy.users[0]?.fullName ?? null,
      ownerEmail: academy.users[0]?.email ?? null,
      studentCount: 0,
      userCount: 1,
      createdAt: academy.createdAt,
    },
  }, { status: 201 })
}
