// Development-only seed script: creates the platform Super Admin account and
// four demo tenants (Basic / Standard / Premium / Inactive) with a small
// amount of realistic data each, to exercise the Super Admin layer end to
// end. Safe to re-run — skips anything that already exists.
//
// Usage: npx tsx scripts/seed-super-admin-demo.ts

import bcrypt from 'bcrypt'
import { PrismaClient, PlanTier } from '@prisma/client'

const prisma = new PrismaClient()

const SUPER_ADMIN_EMAIL = 'superadmin@academymanager.internal'
const SUPER_ADMIN_PASSWORD = 'SuperAdmin!2026'

type TenantSeed = {
  key: string
  name: string
  slug: string
  planTier: PlanTier
  status: 'ACTIVE' | 'INACTIVE'
  ownerName: string
  ownerEmail: string
  ownerPassword: string
}

const TENANTS: TenantSeed[] = [
  { key: 'A', name: 'Sunrise Learners Academy', slug: 'sunrise-learners', planTier: PlanTier.TRIAL, status: 'ACTIVE', ownerName: 'Ayesha Malik', ownerEmail: 'owner@sunrise-learners.test', ownerPassword: 'TenantA!2026' },
  { key: 'B', name: 'Riverside Standard School', slug: 'riverside-standard', planTier: PlanTier.BASIC, status: 'ACTIVE', ownerName: 'Bilal Sheikh', ownerEmail: 'owner@riverside-standard.test', ownerPassword: 'TenantB!2026' },
  { key: 'C', name: 'Crescent Premium Academy', slug: 'crescent-premium', planTier: PlanTier.PRO, status: 'ACTIVE', ownerName: 'Sana Iqbal', ownerEmail: 'owner@crescent-premium.test', ownerPassword: 'TenantC!2026' },
  { key: 'D', name: 'Dormant Gateway School', slug: 'dormant-gateway', planTier: PlanTier.BASIC, status: 'INACTIVE', ownerName: 'Owais Raza', ownerEmail: 'owner@dormant-gateway.test', ownerPassword: 'TenantD!2026' },
]

async function ensureSuperAdmin() {
  const existing = await prisma.superAdmin.findUnique({ where: { email: SUPER_ADMIN_EMAIL } })
  if (existing) {
    console.log(`Super Admin already exists: ${SUPER_ADMIN_EMAIL}`)
    return
  }
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12)
  await prisma.superAdmin.create({
    data: { email: SUPER_ADMIN_EMAIL, passwordHash, fullName: 'Platform Super Admin' },
  })
  console.log(`Created Super Admin: ${SUPER_ADMIN_EMAIL}`)
}

async function ensureTenant(seed: TenantSeed) {
  const existing = await prisma.academy.findUnique({ where: { slug: seed.slug } })
  if (existing) {
    console.log(`Tenant already exists: ${seed.name}`)
    return existing.id
  }

  const passwordHash = await bcrypt.hash(seed.ownerPassword, 12)
  const academy = await prisma.academy.create({
    data: {
      name: seed.name,
      slug: seed.slug,
      planTier: seed.planTier,
      status: seed.status,
      phone: '+92-300-0000000',
      address: '1 Demo Street, Lahore',
      users: { create: { email: seed.ownerEmail, passwordHash, fullName: seed.ownerName, role: 'OWNER' } },
    },
    include: { users: true },
  })
  const owner = academy.users[0]

  const cls = await prisma.class.create({
    data: { academyId: academy.id, name: 'Grade 6', section: 'A', monthlyFee: 12000, teacherId: owner.id },
  })

  const student = await prisma.student.create({
    data: {
      academyId: academy.id,
      classId: cls.id,
      fullName: `${seed.name.split(' ')[0]} Test Student`,
      parentName: 'Demo Parent',
      parentPhone: '0300-1112222',
      monthlyFee: 12000,
      feeInvoices: {
        create: { academyId: academy.id, month: '2026-09', amountDue: 12000, amountPaid: 0, status: 'PENDING', dueDate: new Date() },
      },
    },
  })

  await prisma.attendanceRecord.create({
    data: { academyId: academy.id, studentId: student.id, classId: cls.id, date: new Date(new Date().toDateString()), status: 'PRESENT', markedByUserId: owner.id },
  })

  console.log(`Created tenant: ${seed.name} (${seed.status}, ${seed.planTier}) — owner ${seed.ownerEmail}`)
  return academy.id
}

async function main() {
  await ensureSuperAdmin()
  for (const seed of TENANTS) {
    await ensureTenant(seed)
  }
  console.log('\nDone. See TEST_CREDENTIALS.md for login details.')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
