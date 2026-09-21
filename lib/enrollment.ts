import { Prisma, type PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/prisma'

type Db = PrismaClient | Prisma.TransactionClient

// Minimal academic-history service. Enrollments are the historical record of
// which class a student belonged to in a given academic year. Moving a student
// to a new class NEVER overwrites history: the open enrollment is closed
// (TRANSFERRED) and a fresh one opened, so prior class/year context is kept.

// The tenant's current academic year, creating a sensible default if none is
// configured yet (keeps the feature usable without forcing setup).
export async function getOrCreateCurrentYear(academyId: string, db: Db = defaultPrisma) {
  const existing = await db.academicYear.findFirst({ where: { academyId, isCurrent: true } })
  if (existing) return existing
  const now = new Date()
  // Academic year spanning the current calendar year (Jan–Dec) as a default.
  const y = now.getFullYear()
  return db.academicYear.create({
    data: {
      academyId,
      name: `${y}`,
      startDate: new Date(Date.UTC(y, 0, 1)),
      endDate: new Date(Date.UTC(y, 11, 31)),
      isCurrent: true,
    },
  })
}

// Ensure a student has an open enrollment for the current year in their class.
// Idempotent: no-op if an open enrollment already matches the class.
export async function ensureEnrollment(academyId: string, studentId: string, classId: string, db: Db = defaultPrisma) {
  const year = await getOrCreateCurrentYear(academyId, db)
  const open = await db.enrollment.findFirst({ where: { academyId, studentId, endedAt: null } })
  if (open && open.classId === classId) return open
  if (open) {
    // Close the previous enrollment as a transfer, preserving it.
    await db.enrollment.update({ where: { id: open.id }, data: { status: 'TRANSFERRED', endedAt: new Date() } })
  }
  return db.enrollment.create({
    data: { academyId, studentId, classId, academicYearId: year.id, status: 'ACTIVE' },
  })
}

// Move a student to a new class atomically, preserving the prior enrollment.
export async function moveStudentToClass(academyId: string, studentId: string, newClassId: string, db: PrismaClient = defaultPrisma) {
  return db.$transaction(async (tx) => {
    await tx.student.update({ where: { id: studentId }, data: { classId: newClassId } })
    return ensureEnrollment(academyId, studentId, newClassId, tx)
  })
}

// Full enrollment history for a student (newest first), with class + year context.
export function getEnrollmentHistory(academyId: string, studentId: string, db: Db = defaultPrisma) {
  return db.enrollment.findMany({
    where: { academyId, studentId },
    orderBy: { enrolledAt: 'desc' },
    include: {
      class: { select: { name: true, section: true } },
      academicYear: { select: { name: true } },
    },
  })
}
