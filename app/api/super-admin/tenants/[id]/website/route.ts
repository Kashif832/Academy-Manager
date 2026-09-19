import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/super-session'
import { logAudit } from '@/lib/audit'
import { defaultSiteContent, sanitizeCards, sanitizeFeatures, sanitizeTestimonials, sanitizeFaqs } from '@/lib/site-content'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { id } = await params
  const academy = await prisma.academy.findUnique({ where: { id } })
  if (!academy) return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 })

  const site = await prisma.academySite.findUnique({ where: { academyId: id } })
  const defaults = defaultSiteContent(academy.name)

  return NextResponse.json({
    tagline: site?.tagline ?? defaults.tagline,
    cards: site?.cards ?? defaults.cards,
    features: site?.features ?? defaults.features,
    heroTitle: site?.heroTitle ?? null,
    heroSubtitle: site?.heroSubtitle ?? null,
    heroImageUrl: site?.heroImageUrl ?? null,
    admissionsOpen: site?.admissionsOpen ?? true,
    testimonials: site?.testimonials ?? [],
    faqs: site?.faqs ?? defaults.faqs,
    slug: academy.slug,
    academyName: academy.name,
  })
}

const SECTION_VALIDATORS: Record<string, (data: any) => { data: any; error?: string }> = {
  content: (data) => ({
    data: { tagline: typeof data?.tagline === 'string' ? data.tagline.trim().slice(0, 200) : '', cards: sanitizeCards(data?.cards), features: sanitizeFeatures(data?.features) },
  }),
  testimonials: (data) => ({ data: { testimonials: sanitizeTestimonials(data?.testimonials) } }),
  faqs: (data) => ({ data: { faqs: sanitizeFaqs(data?.faqs) } }),
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { id } = await params
  const academy = await prisma.academy.findUnique({ where: { id } })
  if (!academy) return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const section = typeof body?.section === 'string' ? body.section : ''
  const validator = SECTION_VALIDATORS[section]
  if (!validator) return NextResponse.json({ error: 'Unknown website section.' }, { status: 400 })

  const { data, error } = validator(body?.data)
  if (error) return NextResponse.json({ error }, { status: 400 })

  const site = await prisma.academySite.upsert({
    where: { academyId: id },
    update: data,
    create: { academyId: id, ...data },
  })

  await logAudit({
    academyId: id,
    superAdminId: superAdmin.id,
    action: `tenant.website.${section}_updated`,
    entityType: 'AcademySite',
    entityId: site.id,
  })

  return NextResponse.json({ tagline: site.tagline, cards: site.cards, features: site.features, testimonials: site.testimonials, faqs: site.faqs })
}
