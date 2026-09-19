import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { canManageAcademy } from '@/lib/permissions'
import type { ElectiveSubject } from '@/lib/site-content'

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const activeOnly = request.nextUrl.searchParams.get('activeOnly') === '1'

  const classes = await prisma.class.findMany({
    where: { academyId: user.academyId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: [{ name: 'asc' }, { section: 'asc' }],
    include: {
      teacher: { select: { fullName: true } },
      _count: { select: { students: { where: { status: 'ACTIVE' } } } },
    },
  })

  return NextResponse.json({
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      section: c.section,
      monthlyFee: Number(c.monthlyFee),
      teacherId: c.teacherId,
      teacherName: c.teacher?.fullName ?? null,
      studentCount: c._count.students,
      isActive: c.isActive,
      publicVisible: c.publicVisible,
      publicDescription: c.publicDescription,
      publicSubjects: c.publicSubjects,
      electiveSubjects: c.electiveSubjects as unknown as ElectiveSubject[],
    })),
    canManage: canManageAcademy(user.role),
  })
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  if (!canManageAcademy(user.role)) {
    return NextResponse.json({ error: 'Only owners and admins can add classes.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const section = typeof body?.section === 'string' ? body.section.trim() : ''
  const monthlyFee = Number(body?.monthlyFee)
  const teacherId = typeof body?.teacherId === 'string' && body.teacherId ? body.teacherId : user.id

  if (!name || !section) {
    return NextResponse.json({ error: 'Class name and section are required.' }, { status: 400 })
  }
  if (!Number.isFinite(monthlyFee) || monthlyFee <= 0) {
    return NextResponse.json({ error: 'Monthly fee must be a positive number.' }, { status: 400 })
  }

  const teacher = await prisma.user.findFirst({ where: { id: teacherId, academyId: user.academyId } })
  if (!teacher) return NextResponse.json({ error: 'Selected teacher was not found.' }, { status: 400 })

  const existing = await prisma.class.findFirst({ where: { academyId: user.academyId, name, section } })
  if (existing) {
    return NextResponse.json({ error: 'A class with this name and section already exists.' }, { status: 400 })
  }

  const cls = await prisma.class.create({
    data: { academyId: user.academyId, name, section, monthlyFee, teacherId },
    include: { teacher: { select: { fullName: true } } },
  })

  return NextResponse.json({
    class: {
      id: cls.id,
      name: cls.name,
      section: cls.section,
      monthlyFee: Number(cls.monthlyFee),
      teacherId: cls.teacherId,
      teacherName: cls.teacher?.fullName ?? null,
      studentCount: 0,
      isActive: cls.isActive,
      publicVisible: cls.publicVisible,
      publicDescription: cls.publicDescription,
      publicSubjects: cls.publicSubjects,
      electiveSubjects: cls.electiveSubjects as unknown as ElectiveSubject[],
    },
  }, { status: 201 })
}
