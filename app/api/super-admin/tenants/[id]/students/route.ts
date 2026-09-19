import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/super-session'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { id } = await params
  const students = await prisma.student.findMany({
    where: { academyId: id },
    orderBy: { fullName: 'asc' },
    include: { class: { select: { name: true, section: true } } },
  })

  return NextResponse.json({
    students: students.map((s) => ({
      id: s.id,
      name: s.fullName,
      className: `${s.class.name} · ${s.class.section}`,
      parentName: s.parentName,
      parentPhone: s.parentPhone,
      status: s.status,
      monthlyFee: Number(s.monthlyFee),
      admissionDate: s.admissionDate,
    })),
  })
}
