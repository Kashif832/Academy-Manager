import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/super-session'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { id } = await params
  const classes = await prisma.class.findMany({
    where: { academyId: id },
    orderBy: [{ name: 'asc' }, { section: 'asc' }],
    include: { teacher: { select: { fullName: true } }, _count: { select: { students: { where: { status: 'ACTIVE' } } } } },
  })

  return NextResponse.json({
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      section: c.section,
      monthlyFee: Number(c.monthlyFee),
      teacherName: c.teacher?.fullName ?? null,
      studentCount: c._count.students,
      isActive: c.isActive,
      publicVisible: c.publicVisible,
    })),
  })
}
