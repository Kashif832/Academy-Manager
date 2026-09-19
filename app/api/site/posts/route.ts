import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { canManageAcademy } from '@/lib/permissions'

const VALID_TYPES = new Set(['NEWS', 'EVENT'])

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const posts = await prisma.sitePost.findMany({
    where: { academyId: user.academyId },
    orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ posts, canManage: canManageAcademy(user.role) })
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  if (!canManageAcademy(user.role)) {
    return NextResponse.json({ error: 'Only owners and admins can publish website content.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const type = typeof body?.type === 'string' ? body.type : ''
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  if (!VALID_TYPES.has(type)) return NextResponse.json({ error: 'Invalid post type.' }, { status: 400 })
  if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })

  const post = await prisma.sitePost.create({
    data: {
      academyId: user.academyId,
      type: type as any,
      title: title.slice(0, 160),
      body: typeof body?.body === 'string' && body.body.trim() ? body.body.trim().slice(0, 2000) : null,
      imageUrl: typeof body?.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim().slice(0, 500) : null,
      eventDate: type === 'EVENT' && typeof body?.eventDate === 'string' && body.eventDate.trim() ? new Date(body.eventDate) : null,
      eventTime: type === 'EVENT' && typeof body?.eventTime === 'string' && body.eventTime.trim() ? body.eventTime.trim().slice(0, 20) : null,
      location: type === 'EVENT' && typeof body?.location === 'string' && body.location.trim() ? body.location.trim().slice(0, 200) : null,
      published: Boolean(body?.published),
    },
  })

  return NextResponse.json({ post }, { status: 201 })
}
