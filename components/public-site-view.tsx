'use client'

import { useState } from 'react'
import {
  GraduationCap, Sparkles, Check, Loader2, Phone, MapPin, Clock, Calculator, Send,
  MessageCircle, Newspaper, CalendarDays, ChevronDown, Quote, BookOpen, Users, Plus, X, Menu,
} from 'lucide-react'

type ElectiveSubject = { name: string; monthlyFee: number }
type ClassOption = { id: string; name: string; section: string; monthlyFee: number; description: string | null; subjects: string | null; electives: ElectiveSubject[] }
type FacultyMember = { id: string; name: string; title: string | null; bio: string | null; photoUrl: string | null }
type Post = { id: string; title: string; body: string | null; imageUrl: string | null; date: string | null; time?: string | null; location?: string | null }
type SiteCard = { title: string; description: string }
type SiteTestimonial = { name: string; text: string; className?: string; published: boolean }
type SiteFaq = { question: string; answer: string }

type SiteContent = {
  tagline: string
  cards: SiteCard[]
  features: string[]
  heroTitle: string
  heroSubtitle: string
  heroImageUrl: string | null
  admissionsOpen: boolean
  primaryCtaLabel: string
  secondaryCtaLabel: string
  aboutBody: string | null
  missionText: string | null
  principalName: string | null
  principalMessage: string | null
  principalPhotoUrl: string | null
  testimonials: SiteTestimonial[]
  faqs: SiteFaq[]
}

function currency(amount: number) {
  return `Rs ${Math.round(amount).toLocaleString()}`
}

function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('92')) return digits
  if (digits.startsWith('0')) return `92${digits.slice(1)}`
  return digits
}

function formatDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function HeroMedia({ imageUrl, academyName }: { imageUrl: string | null; academyName: string }) {
  if (imageUrl) {
    return <img src={imageUrl} alt={`${academyName} campus`} className="aspect-[4/3] w-full rounded-2xl border border-primary-foreground/15 object-cover shadow-lg" />
  }
  return (
    <div className="grid aspect-[4/3] w-full grid-cols-2 gap-3 rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-4">
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-primary-foreground/10 p-4 text-center">
        <GraduationCap className="size-8 text-accent" />
        <p className="text-xs font-medium text-primary-foreground/80">Quality education</p>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-primary-foreground/10 p-4 text-center">
        <Users className="size-8 text-accent" />
        <p className="text-xs font-medium text-primary-foreground/80">Caring faculty</p>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-primary-foreground/10 p-4 text-center">
        <BookOpen className="size-8 text-accent" />
        <p className="text-xs font-medium text-primary-foreground/80">Strong academics</p>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-primary-foreground/10 p-4 text-center">
        <Sparkles className="size-8 text-accent" />
        <p className="text-xs font-medium text-primary-foreground/80">A safe campus</p>
      </div>
    </div>
  )
}

export default function PublicSiteView({
  slug, academyName, phone, whatsapp, address, openingHours, content, classes, faculty, news, events,
}: {
  slug: string
  academyName: string
  phone: string | null
  whatsapp: string | null
  address: string | null
  openingHours: string | null
  content: SiteContent
  classes: ClassOption[]
  faculty: FacultyMember[]
  news: Post[]
  events: Post[]
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navItems = [
    { href: '#about', label: 'About', show: Boolean(content.aboutBody || content.missionText || content.principalMessage) },
    { href: '#academics', label: 'Academics', show: classes.length > 0 },
    { href: '#faculty', label: 'Faculty', show: faculty.length > 0 },
    { href: '#news', label: 'News & Events', show: news.length > 0 || events.length > 0 },
    { href: '#faq', label: 'FAQ', show: content.faqs.length > 0 },
    { href: '#admissions', label: 'Contact', show: true },
  ].filter((item) => item.show)

  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><GraduationCap className="size-5" /></div>
          <p className="truncate text-lg font-semibold tracking-tight">{academyName}</p>
        </div>
        <nav className="hidden items-center gap-5 text-sm font-medium text-muted-foreground lg:flex">
          {navItems.map((item) => <a key={item.href} href={item.href} className="hover:text-foreground">{item.label}</a>)}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <a href="#admissions" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm hover:brightness-95">Enquire now</a>
          {navItems.length > 1 && (
            <button onClick={() => setMenuOpen((v) => !v)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} className="grid size-10 place-items-center rounded-xl border text-muted-foreground hover:bg-secondary lg:hidden">
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          )}
        </div>
      </div>
      {menuOpen && (
        <nav className="border-t bg-card lg:hidden">
          <div className="mx-auto flex max-w-6xl flex-col px-4 py-2 sm:px-6">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="rounded-lg px-2 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">{item.label}</a>
            ))}
          </div>
        </nav>
      )}
    </header>

    <section className="border-b bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-medium text-primary-foreground/80">
            <Sparkles className="size-3.5 text-accent" />{content.admissionsOpen ? 'Admissions open' : 'Admissions currently closed'}
          </p>
          <h1 className="mt-5 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-5xl">{content.heroTitle}</h1>
          <p className="mt-4 max-w-xl text-pretty text-base leading-7 text-primary-foreground/80 sm:text-lg">{content.heroSubtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#admissions" className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-sm hover:brightness-95">{content.primaryCtaLabel}</a>
            <a href="#admissions" className="rounded-xl border border-primary-foreground/25 px-5 py-3 text-sm font-semibold hover:bg-primary-foreground/10">{content.secondaryCtaLabel}</a>
          </div>
        </div>
        <HeroMedia imageUrl={content.heroImageUrl} academyName={academyName} />
      </div>
    </section>

    {(content.aboutBody || content.missionText || content.principalMessage) && (
      <section id="about" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">About {academyName}</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {(content.aboutBody || content.missionText) && (
            <div className="space-y-4">
              {content.aboutBody && <p className="text-sm leading-7 text-muted-foreground">{content.aboutBody}</p>}
              {content.missionText && (
                <div className="rounded-2xl border bg-card p-5 shadow-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">Our mission</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{content.missionText}</p>
                </div>
              )}
            </div>
          )}
          {content.principalMessage && (
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <Quote className="size-6 text-accent" />
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{content.principalMessage}</p>
              <div className="mt-4 flex items-center gap-3">
                {content.principalPhotoUrl
                  ? <img src={content.principalPhotoUrl} alt={content.principalName ?? 'Principal'} className="size-11 shrink-0 rounded-full object-cover" />
                  : <div className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">{(content.principalName ?? 'P')[0]}</div>}
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{content.principalName}</p><p className="text-xs text-muted-foreground">Principal's message</p></div>
              </div>
            </div>
          )}
        </div>
      </section>
    )}

    {content.cards.length > 0 && (
      <section className="border-y bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Why families choose us</h2>
          <div className={`mt-6 grid gap-5 sm:grid-cols-2 ${content.cards.length >= 3 ? 'lg:grid-cols-3' : ''} ${content.cards.length >= 4 ? 'xl:grid-cols-4' : ''}`}>
            {content.cards.map((card, i) => (
              <div key={i} className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-primary dark:bg-indigo-500/15"><Sparkles className="size-5" /></div>
                <h3 className="mt-4 font-semibold">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    )}

    {classes.length > 0 && (
      <section id="academics" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">Academic programs</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">Classes currently open for admission.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <div key={c.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <h3 className="font-semibold">{c.name} · {c.section}</h3>
              {c.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{c.description}</p>}
              {c.subjects && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.subjects.split(',').map((s) => s.trim()).filter(Boolean).map((subject) => (
                    <span key={subject} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">{subject}</span>
                  ))}
                </div>
              )}
              <p className="mt-3 text-sm font-medium text-primary">{currency(c.monthlyFee)}<span className="font-normal text-muted-foreground"> /month</span></p>
              {c.electives.length > 0 && <p className="mt-1 text-xs text-muted-foreground">+ optional: {c.electives.map((e) => `${e.name} (${currency(e.monthlyFee)})`).join(', ')}</p>}
            </div>
          ))}
        </div>
      </section>
    )}

    {faculty.length > 0 && (
      <section id="faculty" className="border-y bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Meet our faculty</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {faculty.map((f) => (
              <div key={f.id} className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  {f.photoUrl
                    ? <img src={f.photoUrl} alt={f.name} className="size-12 shrink-0 rounded-full object-cover" />
                    : <div className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">{f.name[0]}</div>}
                  <div className="min-w-0"><p className="truncate font-semibold">{f.name}</p>{f.title && <p className="truncate text-xs text-muted-foreground">{f.title}</p>}</div>
                </div>
                {f.bio && <p className="mt-3 text-sm leading-6 text-muted-foreground">{f.bio}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>
    )}

    {content.features.length > 0 && (
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">Features &amp; achievements</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {content.features.map((feature, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border bg-card p-4">
              <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"><Check className="size-3.5" /></div>
              <p className="text-sm leading-6">{feature}</p>
            </div>
          ))}
        </div>
      </section>
    )}

    {content.testimonials.length > 0 && (
      <section className="border-y bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">What parents say</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {content.testimonials.map((tItem, i) => (
              <div key={i} className="rounded-2xl border bg-card p-5 shadow-sm">
                <Quote className="size-5 text-accent" />
                <p className="mt-3 text-sm leading-6 text-muted-foreground">&ldquo;{tItem.text}&rdquo;</p>
                <p className="mt-4 text-sm font-semibold">{tItem.name}</p>
                {tItem.className && <p className="text-xs text-muted-foreground">Parent · {tItem.className}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>
    )}

    {(news.length > 0 || events.length > 0) && (
      <section id="news" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">News &amp; upcoming events</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {events.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary"><CalendarDays className="size-4" />Upcoming events</h3>
              <div className="mt-3 space-y-3">
                {events.map((e) => (
                  <div key={e.id} className="rounded-xl border bg-card p-4">
                    <p className="font-medium">{e.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(e.date)}{e.time ? ` · ${e.time}` : ''}{e.location ? ` · ${e.location}` : ''}</p>
                    {e.body && <p className="mt-2 text-sm leading-6 text-muted-foreground">{e.body}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {news.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary"><Newspaper className="size-4" />Latest news</h3>
              <div className="mt-3 space-y-3">
                {news.map((n) => (
                  <div key={n.id} className="rounded-xl border bg-card p-4">
                    <p className="font-medium">{n.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(n.date)}</p>
                    {n.body && <p className="mt-2 text-sm leading-6 text-muted-foreground">{n.body}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    )}

    <section id="fee-calculator" className="border-y bg-secondary/40">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">Estimate your monthly fee</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">Add each child with their class and any optional subjects to see an instant estimate, including our sibling discount.</p>
        <FeeCalculator classes={classes} />
      </div>
    </section>

    {content.faqs.length > 0 && (
      <section id="faq" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
        <div className="mt-6 space-y-3">
          {content.faqs.map((faq, i) => (
            <details key={i} className="group rounded-xl border bg-card p-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                {faq.question}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
    )}

    <section id="admissions" className="border-t bg-secondary/40">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Request admission info</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Share a few details and our admissions team will get back to you shortly — or reach us directly below.</p>
            <div className="mt-6 space-y-3 text-sm">
              {phone && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="size-4 shrink-0" />{phone}</p>}
              {address && <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="size-4 shrink-0" />{address}</p>}
              {openingHours && <p className="flex items-center gap-2 text-muted-foreground"><Clock className="size-4 shrink-0" />{openingHours}</p>}
            </div>
            {whatsapp && (
              <a href={`https://wa.me/${whatsappNumber(whatsapp)}?text=${encodeURIComponent(`Hi, I'd like to ask about admissions at ${academyName}.`)}`} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                <MessageCircle className="size-4" />Chat on WhatsApp
              </a>
            )}
          </div>
          <InquiryForm slug={slug} classes={classes} />
        </div>
      </div>
    </section>

    <footer className="border-t bg-card">
      <div className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-muted-foreground sm:px-6">
        © {new Date().getFullYear()} {academyName}. Powered by Academy Manager.
      </div>
    </footer>
  </div>
}

type CalculatorChild = { key: string; classId: string; electives: string[] }

function FeeCalculator({ classes }: { classes: ClassOption[] }) {
  const [children, setChildren] = useState<CalculatorChild[]>(() => (
    classes.length > 0 ? [{ key: crypto.randomUUID(), classId: classes[0].id, electives: [] }] : []
  ))

  if (classes.length === 0) {
    return <div className="mt-6 rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Fee information isn't available yet — please contact us directly.</div>
  }

  function addChild() {
    if (children.length >= 6) return
    setChildren((prev) => [...prev, { key: crypto.randomUUID(), classId: classes[0].id, electives: [] }])
  }
  function removeChild(key: string) {
    setChildren((prev) => (prev.length > 1 ? prev.filter((c) => c.key !== key) : prev))
  }
  function updateChildClass(key: string, classId: string) {
    setChildren((prev) => prev.map((c) => (c.key === key ? { ...c, classId, electives: [] } : c)))
  }
  function toggleElective(key: string, electiveName: string) {
    setChildren((prev) => prev.map((c) => (c.key === key
      ? { ...c, electives: c.electives.includes(electiveName) ? c.electives.filter((n) => n !== electiveName) : [...c.electives, electiveName] }
      : c)))
  }

  const breakdown = children.map((child) => {
    const cls = classes.find((c) => c.id === child.classId) ?? null
    const electivesFee = (cls?.electives ?? []).filter((e) => child.electives.includes(e.name)).reduce((sum, e) => sum + e.monthlyFee, 0)
    return { child, cls, lineTotal: (cls?.monthlyFee ?? 0) + electivesFee, electivesFee }
  })
  const subtotal = breakdown.reduce((sum, b) => sum + b.lineTotal, 0)
  const discountRate = children.length >= 3 ? 0.1 : children.length === 2 ? 0.05 : 0
  const discount = subtotal * discountRate
  const total = subtotal - discount

  return <div className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
    <div className="space-y-4">
      {breakdown.map(({ child, cls, lineTotal }, i) => (
        <div key={child.key} className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Child {i + 1}</span>
            {children.length > 1 && <button onClick={() => removeChild(child.key)} aria-label={`Remove child ${i + 1}`} className="text-muted-foreground hover:text-rose-600"><X className="size-4" /></button>}
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 sm:items-start">
            <label className="text-sm font-medium">Class
              <select value={child.classId} onChange={(e) => updateChildClass(child.key, e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring">
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.section}</option>)}
              </select>
            </label>
            {cls && cls.electives.length > 0 && (
              <div className="text-sm font-medium">Optional subjects
                <div className="mt-2 space-y-1.5">
                  {cls.electives.map((e) => (
                    <label key={e.name} className="flex items-center justify-between gap-2 text-sm font-normal text-muted-foreground">
                      <span className="flex items-center gap-2"><input type="checkbox" checked={child.electives.includes(e.name)} onChange={() => toggleElective(child.key, e.name)} className="size-3.5" />{e.name}</span>
                      <span>+{currency(e.monthlyFee)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="mt-3 text-right text-sm font-semibold">{currency(lineTotal)}<span className="font-normal text-muted-foreground"> /month</span></p>
        </div>
      ))}
    </div>
    <button onClick={addChild} disabled={children.length >= 6} className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-primary disabled:opacity-40"><Plus className="size-4" />Add another child</button>

    <div className="mt-6 rounded-xl bg-primary p-5 text-center text-primary-foreground">
      <div className="flex items-center justify-center gap-2 text-xs text-primary-foreground/70"><Calculator className="size-3.5" />Estimated monthly fee</div>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{currency(total)}</p>
      {discountRate > 0 && <p className="mt-1 text-xs text-accent">Includes {Math.round(discountRate * 100)}% sibling discount</p>}
    </div>
  </div>
}

function InquiryForm({ slug, classes }: { slug: string; classes: ClassOption[] }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [studentName, setStudentName] = useState('')
  const [interestedClassId, setInterestedClassId] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // honeypot — real users never fill this
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/public/site/${slug}/inquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, studentName, interestedClassId: interestedClassId || null, message, website }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      setSent(true)
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"><Check className="size-6" /></div>
      <p className="mt-4 font-medium">Thank you! We've received your enquiry.</p>
      <p className="mt-1 text-sm text-muted-foreground">Our admissions team will reach out to you soon.</p>
    </div>
  }

  return <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
    {error && <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}
    {/* Honeypot field: visually hidden, off-screen, excluded from tab order. */}
    <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
      <label>Website<input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Your name<input required value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. Faisal Ahmed" /></label>
      <label className="text-sm font-medium">Phone<input required value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="03XX XXXXXXX" /></label>
    </div>
    <label className="block text-sm font-medium">Email (optional)<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="you@example.com" /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Child's name (optional)<input value={studentName} onChange={(e) => setStudentName(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. Sara Ahmed" /></label>
      {classes.length > 0 && (
        <label className="text-sm font-medium">Interested class (optional)
          <select value={interestedClassId} onChange={(e) => setInterestedClassId(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal">
            <option value="">Not sure yet</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.section}</option>)}
          </select>
        </label>
      )}
    </div>
    <label className="block text-sm font-medium">Message (optional)<textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="mt-2 w-full resize-none rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="Ask a question, or let us know if you'd like to book a campus visit." /></label>
    <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60">{submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Send enquiry</button>
  </form>
}
