import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { canManageAcademy } from '@/lib/permissions'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  if (!canManageAcademy(user.role)) {
    return NextResponse.json({ error: 'Only owners and admins can edit website content.' }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.sitePost.findFirst({ where: { id, academyId: user.academyId } })
  if (!existing) return NextResponse.json({ error: 'Post not found.' }, { status: 404 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if ('title' in body) {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
    data.title = title.slice(0, 160)
  }
  if ('body' in body) data.body = typeof body.body === 'string' && body.body.trim() ? body.body.trim().slice(0, 2000) : null
  if ('imageUrl' in body) data.imageUrl = typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim().slice(0, 500) : null
  if ('eventDate' in body) data.eventDate = typeof body.eventDate === 'string' && body.eventDate.trim() ? new Date(body.eventDate) : null
  if ('eventTime' in body) data.eventTime = typeof body.eventTime === 'string' && body.eventTime.trim() ? body.eventTime.trim().slice(0, 20) : null
  if ('location' in body) data.location = typeof body.location === 'string' && body.location.trim() ? body.location.trim().slice(0, 200) : null
  if ('published' in body) data.published = Boolean(body.published)

  const post = await prisma.sitePost.update({ where: { id }, data })
  return NextResponse.json({ post })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  if (!canManageAcademy(user.role)) {
    return NextResponse.json({ error: 'Only owners and admins can delete website content.' }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.sitePost.findFirst({ where: { id, academyId: user.academyId } })
  if (!existing) return NextResponse.json({ error: 'Post not found.' }, { status: 404 })

  await prisma.sitePost.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
