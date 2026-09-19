import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const leads = await prisma.siteInquiry.findMany({
    where: { academyId: user.academyId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      interestedClass: { select: { name: true, section: true } },
      assignedTo: { select: { fullName: true } },
    },
  })

  return NextResponse.json({
    leads: leads.map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      email: l.email,
      message: l.message,
      studentName: l.studentName,
      interestedClassId: l.interestedClassId,
      interestedClassName: l.interestedClass ? `${l.interestedClass.name} · ${l.interestedClass.section}` : null,
      source: l.source,
      status: l.status,
      notes: l.notes,
      nextFollowUpAt: l.nextFollowUpAt,
      assignedToUserId: l.assignedToUserId,
      assignedToName: l.assignedTo?.fullName ?? null,
      convertedStudentId: l.convertedStudentId,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
  })
}
