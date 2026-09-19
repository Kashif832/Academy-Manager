import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/super-session'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { id } = await params
  const invoices = await prisma.feeInvoice.findMany({
    where: { academyId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { student: { select: { fullName: true } } },
  })

  return NextResponse.json({
    invoices: invoices.map((inv) => ({
      id: inv.id,
      studentName: inv.student.fullName,
      month: inv.month,
      amountDue: Number(inv.amountDue),
      amountPaid: Number(inv.amountPaid),
      status: inv.status,
      dueDate: inv.dueDate,
    })),
  })
}
