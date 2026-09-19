import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/super-session'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { id } = await params
  const staff = await prisma.user.findMany({
    where: { academyId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, fullName: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
  })

  return NextResponse.json({ staff })
}
