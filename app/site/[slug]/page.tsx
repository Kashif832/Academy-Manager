import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { defaultSiteContent, isPremiumTier, type SiteCard, type SiteTestimonial, type SiteFaq, type ElectiveSubject } from '@/lib/site-content'
import PublicSiteView from '@/components/public-site-view'

export default async function PublicSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const academy = await prisma.academy.findUnique({ where: { slug } })
  if (!academy || !isPremiumTier(academy.planTier)) notFound()

  const [site, classes, faculty, posts] = await Promise.all([
    prisma.academySite.findUnique({ where: { academyId: academy.id } }),
    prisma.class.findMany({
      where: { academyId: academy.id, publicVisible: true, isActive: true },
      orderBy: [{ name: 'asc' }, { section: 'asc' }],
      select: { id: true, name: true, section: true, monthlyFee: true, publicDescription: true, publicSubjects: true, electiveSubjects: true },
    }),
    prisma.user.findMany({
      where: { academyId: academy.id, showOnWebsite: true, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, fullName: true, publicTitle: true, publicBio: true, publicPhotoUrl: true },
    }),
    prisma.sitePost.findMany({
      where: { academyId: academy.id, published: true },
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }],
      take: 12,
    }),
  ])

  const defaults = defaultSiteContent(academy.name)
  const content = site
    ? {
        tagline: site.tagline || defaults.tagline,
        cards: site.cards as unknown as SiteCard[],
        features: site.features as unknown as string[],
        heroTitle: site.heroTitle || academy.name,
        heroSubtitle: site.heroSubtitle || site.tagline || defaults.tagline,
        heroImageUrl: site.heroImageUrl,
        admissionsOpen: site.admissionsOpen,
        primaryCtaLabel: site.primaryCtaLabel,
        secondaryCtaLabel: site.secondaryCtaLabel,
        aboutBody: site.aboutBody,
        missionText: site.missionText,
        principalName: site.principalName,
        principalMessage: site.principalMessage,
        principalPhotoUrl: site.principalPhotoUrl,
        testimonials: (site.testimonials as unknown as SiteTestimonial[]).filter((t) => t.published),
        faqs: site.faqs as unknown as SiteFaq[],
      }
    : { ...defaults, testimonials: [] as SiteTestimonial[] }

  const now = new Date()
  const news = posts.filter((p) => p.type === 'NEWS')
  const upcomingEvents = posts.filter((p) => p.type === 'EVENT' && (!p.eventDate || p.eventDate >= now))

  return (
    <PublicSiteView
      slug={slug}
      academyName={academy.name}
      phone={academy.phone}
      whatsapp={academy.whatsapp}
      address={academy.address}
      openingHours={academy.openingHours}
      content={content}
      classes={classes.map((c) => ({
        id: c.id,
        name: c.name,
        section: c.section,
        monthlyFee: Number(c.monthlyFee),
        description: c.publicDescription,
        subjects: c.publicSubjects,
        electives: c.electiveSubjects as unknown as ElectiveSubject[],
      }))}
      faculty={faculty.map((f) => ({ id: f.id, name: f.fullName, title: f.publicTitle, bio: f.publicBio, photoUrl: f.publicPhotoUrl }))}
      news={news.map((n) => ({ id: n.id, title: n.title, body: n.body, imageUrl: n.imageUrl, date: n.createdAt.toISOString() }))}
      events={upcomingEvents.map((e) => ({ id: e.id, title: e.title, body: e.body, imageUrl: e.imageUrl, date: e.eventDate?.toISOString() ?? null, time: e.eventTime, location: e.location }))}
    />
  )
}
