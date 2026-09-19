export type SiteCard = { title: string; description: string }
export type SiteTestimonial = { name: string; text: string; className?: string; published: boolean }
export type SiteFaq = { question: string; answer: string }
export type ElectiveSubject = { name: string; monthlyFee: number }

export function sanitizeElectiveSubjects(input: unknown): ElectiveSubject[] {
  if (!Array.isArray(input)) return []
  return input
    .slice(0, 10)
    .map((item) => {
      const raw = item as { name?: unknown; monthlyFee?: unknown } | null
      const monthlyFee = Number(raw?.monthlyFee)
      return {
        name: typeof raw?.name === 'string' ? raw.name.trim().slice(0, 60) : '',
        monthlyFee: Number.isFinite(monthlyFee) && monthlyFee >= 0 ? monthlyFee : 0,
      }
    })
    .filter((item) => item.name)
}

export function sanitizePublicSubjects(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const cleaned = input.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20).join(', ')
  return cleaned ? cleaned.slice(0, 300) : null
}

export function defaultSiteContent(academyName: string) {
  return {
    tagline: `Nurturing bright futures at ${academyName}.`,
    heroTitle: academyName,
    heroSubtitle: `Nurturing bright futures at ${academyName}.`,
    heroImageUrl: null as string | null,
    admissionsOpen: true,
    primaryCtaLabel: 'Apply for Admission',
    secondaryCtaLabel: 'Book a Visit',
    aboutBody: `${academyName} is committed to providing a safe, supportive environment where every student is known and encouraged to grow.`,
    missionText: 'To help every student build the knowledge, confidence and character they need to succeed.',
    principalName: '',
    principalMessage: '',
    principalPhotoUrl: '',
    cards: [
      { title: 'Quality Education', description: 'Experienced teachers and a curriculum built for real learning outcomes.' },
      { title: 'Small Class Sizes', description: 'Every student gets the attention they deserve.' },
      { title: 'Modern Facilities', description: 'A safe, well-equipped campus designed for growth.' },
    ] as SiteCard[],
    features: [
      'Qualified & caring staff',
      'Regular parent-teacher communication',
      'Transparent fee structure',
      'Safe & disciplined environment',
    ] as string[],
    testimonials: [] as SiteTestimonial[],
    faqs: [
      { question: 'How can I apply for admission?', answer: 'Fill out the admission enquiry form on this page or contact us directly — our admissions team will get back to you shortly.' },
      { question: 'What documents are required?', answer: "Typically the child's birth certificate, previous school records (if any), and passport-size photographs. Our team will confirm exact requirements for your child's grade." },
      { question: 'Do you offer sibling discounts?', answer: 'Yes, families enrolling more than one child receive a discount — see the fee estimator above for details.' },
    ] as SiteFaq[],
  }
}

export function isPremiumTier(planTier: string) {
  return planTier === 'PRO'
}

export function sanitizeCards(input: unknown): SiteCard[] {
  if (!Array.isArray(input)) return []
  return input
    .slice(0, 4)
    .map((item) => {
      const raw = item as { title?: unknown; description?: unknown } | null
      return {
        title: typeof raw?.title === 'string' ? raw.title.trim().slice(0, 80) : '',
        description: typeof raw?.description === 'string' ? raw.description.trim().slice(0, 300) : '',
      }
    })
    .filter((card) => card.title || card.description)
}

export function sanitizeFeatures(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .slice(0, 12)
    .map((item) => (typeof item === 'string' ? item.trim().slice(0, 120) : ''))
    .filter(Boolean)
}

export function sanitizeTestimonials(input: unknown): SiteTestimonial[] {
  if (!Array.isArray(input)) return []
  return input
    .slice(0, 12)
    .map((item) => {
      const raw = item as { name?: unknown; text?: unknown; className?: unknown; published?: unknown } | null
      return {
        name: typeof raw?.name === 'string' ? raw.name.trim().slice(0, 80) : '',
        text: typeof raw?.text === 'string' ? raw.text.trim().slice(0, 400) : '',
        className: typeof raw?.className === 'string' ? raw.className.trim().slice(0, 60) : '',
        published: Boolean(raw?.published),
      }
    })
    .filter((item) => item.name && item.text)
}

export function sanitizeFaqs(input: unknown): SiteFaq[] {
  if (!Array.isArray(input)) return []
  return input
    .slice(0, 20)
    .map((item) => {
      const raw = item as { question?: unknown; answer?: unknown } | null
      return {
        question: typeof raw?.question === 'string' ? raw.question.trim().slice(0, 200) : '',
        answer: typeof raw?.answer === 'string' ? raw.answer.trim().slice(0, 600) : '',
      }
    })
    .filter((item) => item.question && item.answer)
}
