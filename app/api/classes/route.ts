import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { canManageAcademy } from '@/lib/permissions'
import { getRequestId, jsonError, requireWritable } from '@/lib/http'
import { validateBody } from '@/lib/validation'
import { createClassSchema } from '@/lib/schemas'
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
  const requestId = getRequestId(request)
  const user = await getSessionUser()
  if (!user) return jsonError(401, 'Not authenticated.', requestId)

  const notWritable = requireWritable(user, requestId)
  if (notWritable) return notWritable
  if (!canManageAcademy(user.role)) {
    return jsonError(403, 'Only owners and admins can add classes.', requestId)
  }

  const parsed = await validateBody(request, createClassSchema, requestId)
  if (!parsed.ok) return parsed.response
  const { name, section, monthlyFee } = parsed.data
  const teacherId = parsed.data.teacherId || user.id

  const teacher = await prisma.user.findFirst({ where: { id: teacherId, academyId: user.academyId } })
  if (!teacher) return jsonError(400, 'Selected teacher was not found.', requestId)

  const existing = await prisma.class.findFirst({ where: { academyId: user.academyId, name, section } })
  if (existing) {
    return jsonError(400, 'A class with this name and section already exists.', requestId)
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
