import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { isImpersonatingTenant } from '@/lib/super-session'
import { defaultSiteContent, isPremiumTier, sanitizeCards, sanitizeFeatures, sanitizeTestimonials, sanitizeFaqs } from '@/lib/site-content'

function siteToJson(site: NonNullable<Awaited<ReturnType<typeof prisma.academySite.findUnique>>>) {
  return {
    tagline: site.tagline,
    cards: site.cards,
    features: site.features,
    heroTitle: site.heroTitle,
    heroSubtitle: site.heroSubtitle,
    heroImageUrl: site.heroImageUrl,
    admissionsOpen: site.admissionsOpen,
    primaryCtaLabel: site.primaryCtaLabel,
    secondaryCtaLabel: site.secondaryCtaLabel,
    aboutBody: site.aboutBody,
    missionText: site.missionText,
    principalName: site.principalName,
    principalMessage: site.principalMessage,
    principalPhotoUrl: site.principalPhotoUrl,
    testimonials: site.testimonials,
    faqs: site.faqs,
  }
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  let site = await prisma.academySite.findUnique({ where: { academyId: user.academyId } })
  if (!site) {
    const defaults = defaultSiteContent(user.academy.name)
    site = await prisma.academySite.create({
      data: {
        academyId: user.academyId,
        tagline: defaults.tagline,
        cards: defaults.cards,
        features: defaults.features,
        heroTitle: defaults.heroTitle,
        heroSubtitle: defaults.heroSubtitle,
        admissionsOpen: defaults.admissionsOpen,
        primaryCtaLabel: defaults.primaryCtaLabel,
        secondaryCtaLabel: defaults.secondaryCtaLabel,
        aboutBody: defaults.aboutBody,
        missionText: defaults.missionText,
        faqs: defaults.faqs,
      },
    })
  }

  const isPremium = isPremiumTier(user.academy.planTier) || (await isImpersonatingTenant(user.academyId))

  return NextResponse.json({
    ...siteToJson(site),
    slug: user.academy.slug,
    academyName: user.academy.name,
    isPremium,
    planTier: user.academy.planTier,
  })
}

const SITE_SECTION_VALIDATORS: Record<string, (data: any) => { data: any; error?: string }> = {
  content: (data) => {
    const tagline = typeof data?.tagline === 'string' ? data.tagline.trim().slice(0, 200) : ''
    return { data: { tagline, cards: sanitizeCards(data?.cards), features: sanitizeFeatures(data?.features) } }
  },
  hero: (data) => {
    return {
      data: {
        heroTitle: typeof data?.heroTitle === 'string' && data.heroTitle.trim() ? data.heroTitle.trim().slice(0, 120) : null,
        heroSubtitle: typeof data?.heroSubtitle === 'string' && data.heroSubtitle.trim() ? data.heroSubtitle.trim().slice(0, 240) : null,
        heroImageUrl: typeof data?.heroImageUrl === 'string' && data.heroImageUrl.trim() ? data.heroImageUrl.trim().slice(0, 500) : null,
        admissionsOpen: Boolean(data?.admissionsOpen),
        primaryCtaLabel: typeof data?.primaryCtaLabel === 'string' && data.primaryCtaLabel.trim() ? data.primaryCtaLabel.trim().slice(0, 40) : 'Apply for Admission',
        secondaryCtaLabel: typeof data?.secondaryCtaLabel === 'string' && data.secondaryCtaLabel.trim() ? data.secondaryCtaLabel.trim().slice(0, 40) : 'Book a Visit',
      },
    }
  },
  about: (data) => {
    return {
      data: {
        aboutBody: typeof data?.aboutBody === 'string' && data.aboutBody.trim() ? data.aboutBody.trim().slice(0, 800) : null,
        missionText: typeof data?.missionText === 'string' && data.missionText.trim() ? data.missionText.trim().slice(0, 400) : null,
        principalName: typeof data?.principalName === 'string' && data.principalName.trim() ? data.principalName.trim().slice(0, 80) : null,
        principalMessage: typeof data?.principalMessage === 'string' && data.principalMessage.trim() ? data.principalMessage.trim().slice(0, 600) : null,
        principalPhotoUrl: typeof data?.principalPhotoUrl === 'string' && data.principalPhotoUrl.trim() ? data.principalPhotoUrl.trim().slice(0, 500) : null,
      },
    }
  },
  testimonials: (data) => ({ data: { testimonials: sanitizeTestimonials(data?.testimonials) } }),
  faqs: (data) => ({ data: { faqs: sanitizeFaqs(data?.faqs) } }),
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  if (!isPremiumTier(user.academy.planTier) && !(await isImpersonatingTenant(user.academyId))) {
    return NextResponse.json({ error: 'Upgrade to the Premium plan to edit your public site.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const section = typeof body?.section === 'string' ? body.section : ''
  const validator = SITE_SECTION_VALIDATORS[section]
  if (!validator) return NextResponse.json({ error: 'Unknown website section.' }, { status: 400 })

  const { data, error } = validator(body?.data)
  if (error) return NextResponse.json({ error }, { status: 400 })

  const site = await prisma.academySite.upsert({
    where: { academyId: user.academyId },
    update: data,
    create: { academyId: user.academyId, ...data },
  })

  return NextResponse.json(siteToJson(site))
}
