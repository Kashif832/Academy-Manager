import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { canManageAcademy } from '@/lib/permissions'
import { hasReportsAccess, hasWebsiteAccess, staffLimitFor, tierLabel } from '@/lib/tiers'
import { logAudit } from '@/lib/audit'
import { DEFAULT_REMINDER_TEMPLATE } from '@/lib/settings-content'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const academy = user.academy

  return NextResponse.json({
    canManage: canManageAcademy(user.role),
    profile: {
      name: academy.name,
      logoUrl: academy.logoUrl,
      phone: academy.phone,
      whatsapp: academy.whatsapp,
      address: academy.address,
      openingHours: academy.openingHours,
      description: academy.description,
      slug: academy.slug,
    },
    receipts: {
      receiptPrefix: academy.receiptPrefix,
    },
    templates: {
      reminderTemplate: academy.reminderTemplate,
      reminderTemplateDefault: DEFAULT_REMINDER_TEMPLATE,
    },
    subscription: {
      planTier: academy.planTier,
      planLabel: tierLabel(academy.planTier),
      trialEndsAt: academy.trialEndsAt,
      hasReports: hasReportsAccess(academy.planTier),
      hasWebsite: hasWebsiteAccess(academy.planTier),
      staffLimit: staffLimitFor(academy.planTier),
    },
  })
}

const SECTION_VALIDATORS: Record<string, (data: any) => { data: any; error?: string }> = {
  profile: (data) => {
    const name = typeof data?.name === 'string' ? data.name.trim() : ''
    if (!name) return { data: null, error: 'Academy name is required.' }
    if (name.length > 120) return { data: null, error: 'Academy name is too long.' }
    return {
      data: {
        name,
        logoUrl: typeof data?.logoUrl === 'string' && data.logoUrl.trim() ? data.logoUrl.trim().slice(0, 500) : null,
        phone: typeof data?.phone === 'string' && data.phone.trim() ? data.phone.trim().slice(0, 40) : null,
        whatsapp: typeof data?.whatsapp === 'string' && data.whatsapp.trim() ? data.whatsapp.trim().slice(0, 40) : null,
        address: typeof data?.address === 'string' && data.address.trim() ? data.address.trim().slice(0, 300) : null,
        openingHours: typeof data?.openingHours === 'string' && data.openingHours.trim() ? data.openingHours.trim().slice(0, 200) : null,
        description: typeof data?.description === 'string' && data.description.trim() ? data.description.trim().slice(0, 500) : null,
      },
    }
  },
  receipts: (data) => {
    const prefix = typeof data?.receiptPrefix === 'string' ? data.receiptPrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : ''
    if (!prefix) return { data: null, error: 'Receipt prefix is required (letters and numbers only).' }
    if (prefix.length > 10) return { data: null, error: 'Receipt prefix must be 10 characters or fewer.' }
    return { data: { receiptPrefix: prefix } }
  },
  templates: (data) => {
    const raw = typeof data?.reminderTemplate === 'string' ? data.reminderTemplate.trim() : ''
    return { data: { reminderTemplate: raw ? raw.slice(0, 1000) : null } }
  },
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  if (!canManageAcademy(user.role)) {
    return NextResponse.json({ error: 'Only owners and admins can change academy settings.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const section = typeof body?.section === 'string' ? body.section : ''
  const validator = SECTION_VALIDATORS[section]
  if (!validator) return NextResponse.json({ error: 'Unknown settings section.' }, { status: 400 })

  const { data, error } = validator(body?.data)
  if (error) return NextResponse.json({ error }, { status: 400 })

  const updated = await prisma.academy.update({ where: { id: user.academyId }, data })

  await logAudit({
    academyId: user.academyId,
    userId: user.id,
    action: `settings.${section}.updated`,
    entityType: 'Academy',
    entityId: user.academyId,
    metadata: data,
  })

  if (section === 'profile') {
    return NextResponse.json({ profile: { name: updated.name, logoUrl: updated.logoUrl, phone: updated.phone, whatsapp: updated.whatsapp, address: updated.address, openingHours: updated.openingHours, description: updated.description, slug: updated.slug } })
  }
  if (section === 'receipts') {
    return NextResponse.json({ receipts: { receiptPrefix: updated.receiptPrefix } })
  }
  return NextResponse.json({ templates: { reminderTemplate: updated.reminderTemplate, reminderTemplateDefault: DEFAULT_REMINDER_TEMPLATE } })
}
