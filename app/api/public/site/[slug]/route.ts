import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { defaultSiteContent, isPremiumTier } from '@/lib/site-content'

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const academy = await prisma.academy.findUnique({ where: { slug } })
  if (!academy || !isPremiumTier(academy.planTier)) {
    return NextResponse.json({ error: 'This site is not available.' }, { status: 404 })
  }

  const [site, classes] = await Promise.all([
    prisma.academySite.findUnique({ where: { academyId: academy.id } }),
    prisma.class.findMany({
      where: { academyId: academy.id },
      orderBy: [{ name: 'asc' }, { section: 'asc' }],
      select: { id: true, name: true, section: true, monthlyFee: true },
    }),
  ])

  const content = site
    ? { tagline: site.tagline, cards: site.cards, features: site.features }
    : defaultSiteContent(academy.name)

  return NextResponse.json({
    academyName: academy.name,
    phone: academy.phone,
    address: academy.address,
    tagline: content.tagline,
    cards: content.cards,
    features: content.features,
    classes: classes.map((c) => ({ id: c.id, name: c.name, section: c.section, monthlyFee: Number(c.monthlyFee) })),
  })
}
