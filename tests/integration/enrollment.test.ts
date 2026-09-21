import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { connectTestDb } from './pg'
import { getOrCreateCurrentYear, ensureEnrollment, moveStudentToClass, getEnrollmentHistory } from '../../lib/enrollment'

// Academic history: moving a student between classes must preserve prior
// enrollment records (multi-year/class history), never overwrite them.
let prisma: PrismaClient | null = null
const tag = 'enr-' + Date.now()
let academyId = ''
let classA = ''
let classB = ''
let studentId = ''

beforeAll(async () => {
  prisma = await connectTestDb()
  if (!prisma) return
  const a = await prisma.academy.create({ data: { name: 'Enr Academy', slug: `${tag}` } })
  academyId = a.id
  classA = (await prisma.class.create({ data: { academyId, name: 'Grade 1', section: 'A', monthlyFee: 1000 } })).id
  classB = (await prisma.class.create({ data: { academyId, name: 'Grade 2', section: 'B', monthlyFee: 1200 } })).id
  studentId = (await prisma.student.create({ data: { academyId, classId: classA, fullName: 'Mover', parentName: 'P', parentPhone: '1', monthlyFee: 1000 } })).id
}, 60_000)

afterAll(async () => {
  if (!prisma) return
  await prisma.academy.deleteMany({ where: { slug: { startsWith: tag } } }).catch(() => {})
  await prisma.$disconnect().catch(() => {})
})

describe('academic history / enrollment (real PostgreSQL)', () => {
  it('creates a default current academic year on demand', async () => {
    if (!prisma) return
    const year = await getOrCreateCurrentYear(academyId, prisma)
    expect(year.isCurrent).toBe(true)
    // Idempotent.
    const again = await getOrCreateCurrentYear(academyId, prisma)
    expect(again.id).toBe(year.id)
  })

  it('opens an ACTIVE enrollment for the student in their class', async () => {
    if (!prisma) return
    const e = await ensureEnrollment(academyId, studentId, classA, prisma)
    expect(e.classId).toBe(classA)
    expect(e.status).toBe('ACTIVE')
    expect(e.endedAt).toBeNull()
  })

  it('moving classes closes the old enrollment (TRANSFERRED) and opens a new one — history preserved', async () => {
    if (!prisma) return
    await moveStudentToClass(academyId, studentId, classB, prisma)

    const history = await getEnrollmentHistory(academyId, studentId, prisma)
    expect(history.length).toBe(2)
    const current = history.find((h) => h.endedAt === null)
    const previous = history.find((h) => h.endedAt !== null)
    expect(current?.classId).toBe(classB)
    expect(current?.status).toBe('ACTIVE')
    expect(previous?.classId).toBe(classA) // prior class kept
    expect(previous?.status).toBe('TRANSFERRED')
    // Student's current class updated too.
    expect((await prisma.student.findUnique({ where: { id: studentId } }))?.classId).toBe(classB)
  })

  it('is idempotent when the student is already in the target class', async () => {
    if (!prisma) return
    const before = (await getEnrollmentHistory(academyId, studentId, prisma)).length
    await ensureEnrollment(academyId, studentId, classB, prisma)
    const after = (await getEnrollmentHistory(academyId, studentId, prisma)).length
    expect(after).toBe(before) // no new row
  })
})
