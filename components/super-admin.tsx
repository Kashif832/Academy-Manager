'use client'

import { useEffect, useState } from 'react'
import {
  ShieldCheck, Building2, Users, GraduationCap, LayoutDashboard, Settings,
  FileText, LogOut, Plus, Search, X, Check, Loader2, ChevronDown, ArrowUpRight,
  Eye, Pencil, Power, History, Globe2, CreditCard, BookOpen, Receipt,
  CalendarCheck2, UserRoundCog, ArrowLeft, Menu, ArrowUpCircle, LogIn,
} from 'lucide-react'

function currency(amount: number) {
  return `Rs ${Math.round(amount).toLocaleString()}`
}

function tierBadgeLabel(planTier: string) {
  if (planTier === 'PRO') return 'Tier 3 · Premium'
  if (planTier === 'BASIC') return 'Tier 2 · Standard'
  return 'Tier 1 · Basic'
}

function tierToneClass(planTier: string) {
  if (planTier === 'PRO') return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
  if (planTier === 'BASIC') return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
  return 'bg-secondary text-secondary-foreground'
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone === 'green' ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : tone === 'red' ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400' : tone === 'amber' ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400' : 'bg-secondary text-secondary-foreground'}`}>{children}</span>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])
  return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4">
    <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl">
      <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">{title}</h2><button onClick={onClose} aria-label="Close"><X className="size-5" /></button></div>
      <div className="mt-6 max-h-[70vh] overflow-y-auto">{children}</div>
    </div>
  </div>
}

type SuperAdminUser = { id: string; email: string; fullName: string }

export default function SuperAdmin() {
  const [authState, setAuthState] = useState<'loading' | 'signed-out' | 'signed-in'>('loading')
  const [superAdmin, setSuperAdmin] = useState<SuperAdminUser | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/super-admin/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.superAdmin) { setSuperAdmin(data.superAdmin); setAuthState('signed-in') }
        else setAuthState('signed-out')
      })
      .catch(() => { if (!cancelled) setAuthState('signed-out') })
    return () => { cancelled = true }
  }, [])

  if (authState === 'loading') {
    return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }
  if (authState === 'signed-out' || !superAdmin) {
    return <SuperAdminLogin onSignedIn={(sa) => { setSuperAdmin(sa); setAuthState('signed-in') }} />
  }
  return <SuperAdminShell superAdmin={superAdmin} onSignedOut={() => { setSuperAdmin(null); setAuthState('signed-out') }} />
}

function SuperAdminLogin({ onSignedIn }: { onSignedIn: (sa: SuperAdminUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/super-admin/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      onSignedIn(data.superAdmin)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
    <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></div>
        <div><p className="font-semibold tracking-tight">Academy Manager</p><p className="text-xs text-muted-foreground">Super Admin</p></div>
      </div>
      <h1 className="mt-6 text-xl font-semibold">Platform sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Restricted to platform administrators only.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && <p className="rounded-xl bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-400">{error}</p>}
        <label className="block text-sm font-medium">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="superadmin@academymanager.internal" /></label>
        <label className="block text-sm font-medium">Password<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="Enter your password" /></label>
        <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60">{submitting && <Loader2 className="size-4 animate-spin" />}Sign in</button>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground">This is a separate platform-level login, distinct from academy accounts.</p>
    </div>
  </div>
}

type NavKey = 'dashboard' | 'tenants' | 'planRequests' | 'plans' | 'logs' | 'settings'
const NAV: { key: NavKey; label: string; icon: any }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'tenants', label: 'Tenants', icon: Building2 },
  { key: 'planRequests', label: 'Plan Requests', icon: ArrowUpCircle },
  { key: 'plans', label: 'Plans & Features', icon: CreditCard },
  { key: 'logs', label: 'Activity Logs', icon: History },
  { key: 'settings', label: 'Platform Settings', icon: Settings },
]

function SuperAdminShell({ superAdmin, onSignedOut }: { superAdmin: SuperAdminUser; onSignedOut: () => void }) {
  const [active, setActive] = useState<NavKey>('dashboard')
  const [managingTenantId, setManagingTenantId] = useState<string | null>(null)
  const [managingTenantName, setManagingTenantName] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  const [impersonating, setImpersonating] = useState(false)
  const [impersonateError, setImpersonateError] = useState('')

  async function handleSignOut() {
    await fetch('/api/super-admin/auth/logout', { method: 'POST' })
    onSignedOut()
  }

  function inspectTenant(id: string, name: string) {
    setManagingTenantId(id)
    setManagingTenantName(name)
  }
  function exitInspect() {
    setManagingTenantId(null)
    setManagingTenantName('')
  }

  // Full management access: sign the Super Admin into the tenant's own
  // account and hand off to the real tenant application — every existing
  // module (Students, Fees, Attendance, Staff, Reports, Website, Settings,
  // Admissions…) then works exactly as it does for the tenant, with nothing
  // duplicated.
  async function manageTenant(id: string) {
    setImpersonateError('')
    setImpersonating(true)
    try {
      const res = await fetch(`/api/super-admin/tenants/${id}/impersonate`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setImpersonateError(data.error ?? 'Could not enter this tenant.'); setImpersonating(false); return }
      window.location.href = '/'
    } catch {
      setImpersonateError('Could not reach the server.')
      setImpersonating(false)
    }
  }

  return <div className="min-h-screen bg-background text-foreground">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r bg-card p-5 transition-transform lg:w-64 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></div><div className="min-w-0"><p className="truncate font-semibold tracking-tight">Academy Manager</p><p className="truncate text-xs text-muted-foreground">Super Admin</p></div></div>
        <button className="shrink-0 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="size-5" /></button>
      </div>
      <div className="mt-10 flex flex-col gap-1">
        {NAV.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => { setActive(key); setMobileOpen(false) }} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${active === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
            <Icon className="size-4 shrink-0" />{label}
          </button>
        ))}
      </div>
      <div className="mt-auto space-y-3">
        <div className="rounded-xl bg-secondary p-3 text-sm"><p className="font-medium">{superAdmin.fullName}</p><p className="truncate text-xs text-muted-foreground">{superAdmin.email}</p></div>
        <button onClick={handleSignOut} className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"><LogOut className="size-4" />Sign out</button>
      </div>
    </aside>
    {mobileOpen && <div className="fixed inset-0 z-30 bg-foreground/30 lg:hidden" onClick={() => setMobileOpen(false)} />}

    <div className="lg:pl-64">
      {managingTenantId && (
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-primary px-4 py-2.5 text-sm text-primary-foreground sm:px-8">
          <span className="flex min-w-0 items-center gap-2"><ShieldCheck className="size-4 shrink-0 text-accent" /><span className="truncate">SUPER ADMIN · Inspecting: <b>{managingTenantName}</b></span></span>
          <button onClick={exitInspect} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold hover:bg-primary-foreground/20"><ArrowLeft className="size-3.5" />Exit</button>
        </div>
      )}
      {impersonateError && (
        <div className="border-b bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 sm:px-8">{impersonateError}</div>
      )}
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur sm:px-4 md:px-8" style={managingTenantId ? { top: '2.5rem' } : undefined}>
        <button onClick={() => setMobileOpen(true)} className="shrink-0 lg:hidden" aria-label="Open menu"><Menu className="size-5" /></button>
        <h1 className="truncate text-lg font-semibold">{managingTenantId ? managingTenantName : NAV.find((n) => n.key === active)?.label}</h1>
      </header>
      <main className="mx-auto max-w-7xl p-4 md:p-8">
        {managingTenantId
          ? <TenantManageView tenantId={managingTenantId} onExit={exitInspect} onManageTenant={manageTenant} impersonating={impersonating} />
          : active === 'dashboard' ? <DashboardView onInspectTenant={inspectTenant} onManageTenant={manageTenant} impersonating={impersonating} onGoToTenants={() => setActive('tenants')} onGoToPlanRequests={() => setActive('planRequests')} />
          : active === 'tenants' ? <TenantsView onInspectTenant={inspectTenant} onManageTenant={manageTenant} impersonating={impersonating} />
          : active === 'planRequests' ? <PlanRequestsView />
          : active === 'plans' ? <PlansView />
          : active === 'logs' ? <LogsView />
          : <PlatformSettingsView />}
      </main>
    </div>
  </div>
}

type DashboardStats = { totalTenants: number; activeTenants: number; inactiveTenants: number; tier1Count: number; tier2Count: number; tier3Count: number; totalStudents: number; totalStaff: number; newTenantsThisMonth: number }
type RecentTenant = { id: string; name: string; planTier: string; status: string; createdAt: string }
type ActivityItem = { id: string; action: string; entityType: string; tenantName: string | null; actorName: string; actorType: string; createdAt: string }

function humanizeAction(action: string) {
  return action.replace(/\./g, ' › ').replace(/_/g, ' ')
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
    <div className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-primary dark:bg-indigo-500/15"><Icon className="size-5" /></div>
    <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
    <p className="mt-1 text-sm text-muted-foreground">{label}</p>
  </div>
}

function DashboardView({ onInspectTenant, onManageTenant, impersonating, onGoToTenants, onGoToPlanRequests }: { onInspectTenant: (id: string, name: string) => void; onManageTenant: (id: string) => void; impersonating: boolean; onGoToTenants: () => void; onGoToPlanRequests: () => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentTenants, setRecentTenants] = useState<RecentTenant[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [pendingRequestCount, setPendingRequestCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/super-admin/dashboard').then((res) => res.json()),
      fetch('/api/super-admin/plan-requests').then((res) => res.json()),
    ]).then(([dash, requests]) => {
      setStats(dash.stats); setRecentTenants(dash.recentTenants ?? []); setRecentActivity(dash.recentActivity ?? [])
      setPendingRequestCount((requests.requests ?? []).filter((r: any) => r.status === 'PENDING').length)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  if (loading || !stats) {
    return <div className="grid place-items-center rounded-2xl border bg-card p-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
  }

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard icon={Building2} label="Total tenants" value={stats.totalTenants} />
      <StatCard icon={ShieldCheck} label="Active tenants" value={stats.activeTenants} />
      <StatCard icon={Power} label="Inactive tenants" value={stats.inactiveTenants} />
      <StatCard icon={GraduationCap} label="Total students" value={stats.totalStudents} />
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard icon={CreditCard} label="Tier 1 · Basic" value={stats.tier1Count} />
      <StatCard icon={CreditCard} label="Tier 2 · Standard" value={stats.tier2Count} />
      <StatCard icon={CreditCard} label="Tier 3 · Premium" value={stats.tier3Count} />
      <StatCard icon={Users} label="Total staff" value={stats.totalStaff} />
    </div>

    {pendingRequestCount > 0 && (
      <button onClick={onGoToPlanRequests} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-left shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
        <span className="flex items-center gap-3"><ArrowUpCircle className="size-5 text-amber-600 dark:text-amber-400" /><span className="text-sm font-semibold text-amber-800 dark:text-amber-400">{pendingRequestCount} pending plan upgrade request{pendingRequestCount === 1 ? '' : 's'}</span></span>
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-400">Review →</span>
      </button>
    )}

    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between"><h2 className="font-semibold">Recent tenants</h2><button onClick={onGoToTenants} className="text-sm font-semibold text-primary">View all</button></div>
      <div className="mt-4 divide-y">
        {recentTenants.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No tenants yet.</p> : recentTenants.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0"><p className="truncate font-medium">{t.name}</p><p className="text-xs text-muted-foreground">Created {new Date(t.createdAt).toLocaleDateString()}</p></div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge tone="neutral">{tierBadgeLabel(t.planTier)}</Badge>
              <Badge tone={t.status === 'ACTIVE' ? 'green' : 'red'}>{t.status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge>
              <button onClick={() => onInspectTenant(t.id, t.name)} className="text-sm font-semibold text-primary">Inspect</button>
              <button onClick={() => onManageTenant(t.id)} disabled={impersonating} className="inline-flex items-center gap-1 text-sm font-semibold text-primary disabled:opacity-50"><LogIn className="size-3.5" />Manage</button>
            </div>
          </div>
        ))}
      </div>
    </section>

    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="font-semibold">Recent platform activity</h2>
      <div className="mt-4 divide-y">
        {recentActivity.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No activity yet.</p> : recentActivity.map((a) => (
          <div key={a.id} className="py-3 text-sm">
            <p><span className="font-medium">{a.actorName}</span> <span className="text-muted-foreground">{humanizeAction(a.action)}</span>{a.tenantName && <> · <span className="font-medium">{a.tenantName}</span></>}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </section>

    <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm hover:brightness-95"><Plus className="size-4" />Create Tenant</button>
    {showCreate && <CreateTenantModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}
  </div>
}

type TenantRow = { id: string; name: string; slug: string; planTier: string; status: string; ownerName: string | null; ownerEmail: string | null; studentCount: number; userCount: number; createdAt: string }

function TenantsView({ onInspectTenant, onManageTenant, impersonating }: { onInspectTenant: (id: string, name: string) => void; onManageTenant: (id: string) => void; impersonating: boolean }) {
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editingTenant, setEditingTenant] = useState<TenantRow | null>(null)

  function load() {
    setLoading(true)
    fetch('/api/super-admin/tenants').then((res) => res.json()).then((data) => setTenants(data.tenants ?? [])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const filtered = tenants.filter((t) => {
    const q = query.trim().toLowerCase()
    const matchesQuery = !q || t.name.toLowerCase().includes(q) || (t.ownerName ?? '').toLowerCase().includes(q) || (t.ownerEmail ?? '').toLowerCase().includes(q)
    const matchesTier = tierFilter === 'all' || t.planTier === tierFilter
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter
    return matchesQuery && matchesTier && matchesStatus
  })

  return <section className="rounded-2xl border bg-card shadow-sm">
    <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-xl font-semibold">Tenants</h2><p className="mt-1 text-sm text-muted-foreground">{tenants.length} academy account{tenants.length === 1 ? '' : 's'} on the platform.</p></div>
      <button onClick={() => setShowCreate(true)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground"><Plus className="size-4" />Create Tenant</button>
    </div>
    <div className="flex flex-wrap gap-2 border-b p-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3"><Search className="size-4 shrink-0 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full min-w-0 bg-transparent py-2 text-sm outline-none" placeholder="Search by academy or owner" /></div>
      <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="rounded-xl border bg-background px-3 py-2 text-sm"><option value="all">All tiers</option><option value="TRIAL">Tier 1 · Basic</option><option value="BASIC">Tier 2 · Standard</option><option value="PRO">Tier 3 · Premium</option></select>
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border bg-background px-3 py-2 text-sm"><option value="all">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
    </div>
    {loading ? (
      <div className="grid place-items-center p-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
    ) : filtered.length === 0 ? (
      <div className="grid place-items-center p-16 text-center"><Building2 className="size-10 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">No tenants found</h3></div>
    ) : (
      <>
      {/* Mobile: card list */}
      <div className="divide-y sm:hidden">{filtered.map((t) => (
        <div key={t.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="truncate font-medium">{t.name}</p><p className="truncate text-xs text-muted-foreground">{t.ownerName ?? '—'} · {t.studentCount} students</p></div>
            <div className="flex shrink-0 flex-col items-end gap-1"><Badge tone="neutral">{tierBadgeLabel(t.planTier)}</Badge><Badge tone={t.status === 'ACTIVE' ? 'green' : 'red'}>{t.status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button onClick={() => setEditingTenant(t)} className="text-sm font-semibold text-primary">Edit</button>
            <button onClick={() => onInspectTenant(t.id, t.name)} className="text-sm font-semibold text-primary">Inspect</button>
            <button onClick={() => onManageTenant(t.id)} disabled={impersonating} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"><LogIn className="size-3.5" />Manage</button>
          </div>
        </div>
      ))}</div>
      {/* Tablet & up: table */}
      <div className="hidden overflow-x-auto sm:block"><table className="w-full text-left text-sm"><thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground"><tr>
        <th className="px-5 py-3 font-medium">Academy</th><th className="px-5 py-3 font-medium">Owner</th><th className="px-5 py-3 font-medium">Plan</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Students</th><th className="px-5 py-3 font-medium">Created</th><th className="px-5 py-3 text-right font-medium">Actions</th>
      </tr></thead><tbody className="divide-y">{filtered.map((t) => (
        <tr key={t.id}>
          <td className="px-5 py-4 font-medium">{t.name}</td>
          <td className="px-5 py-4 text-muted-foreground">{t.ownerName ?? '—'}</td>
          <td className="px-5 py-4"><Badge tone="neutral">{tierBadgeLabel(t.planTier)}</Badge></td>
          <td className="px-5 py-4"><Badge tone={t.status === 'ACTIVE' ? 'green' : 'red'}>{t.status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge></td>
          <td className="px-5 py-4 text-muted-foreground">{t.studentCount}</td>
          <td className="px-5 py-4 text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</td>
          <td className="px-5 py-4">
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setEditingTenant(t)} className="text-sm font-semibold text-primary">Edit</button>
              <button onClick={() => onInspectTenant(t.id, t.name)} className="text-sm font-semibold text-primary">Inspect</button>
              <button onClick={() => onManageTenant(t.id)} disabled={impersonating} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"><LogIn className="size-3.5" />Manage</button>
            </div>
          </td>
        </tr>
      ))}</tbody></table></div>
      </>
    )}
    {showCreate && <CreateTenantModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}
    {editingTenant && <EditTenantModal tenant={editingTenant} onClose={() => setEditingTenant(null)} onSaved={() => { setEditingTenant(null); load() }} />}
  </section>
}

function CreateTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [planTier, setPlanTier] = useState('TRIAL')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/super-admin/tenants', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ownerName, ownerEmail, ownerPassword, phone, address, planTier }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      onCreated()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  return <Modal title="Create tenant" onClose={onClose}>
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-xl bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-400">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">Academy name<input required value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
        <label className="text-sm font-medium">Owner name<input required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
        <label className="text-sm font-medium">Owner email<input required type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
        <label className="text-sm font-medium sm:col-span-2">Initial password<input required type="password" minLength={6} value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="At least 6 characters" /></label>
        <label className="text-sm font-medium">Phone (optional)<input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
        <label className="text-sm font-medium">Subscription tier<select value={planTier} onChange={(e) => setPlanTier(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal"><option value="TRIAL">Tier 1 · Basic</option><option value="BASIC">Tier 2 · Standard</option><option value="PRO">Tier 3 · Premium</option></select></label>
        <label className="text-sm font-medium sm:col-span-2">Address (optional)<input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
      </div>
      <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground disabled:opacity-60">{submitting && <Loader2 className="size-4 animate-spin" />}Create tenant</button>
    </form>
  </Modal>
}

function EditTenantModal({ tenant, onClose, onSaved }: { tenant: TenantRow; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(tenant.name)
  const [planTier, setPlanTier] = useState(tenant.planTier)
  const [status, setStatus] = useState(tenant.status)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, planTier, status }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      onSaved()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  return <Modal title={`Edit ${tenant.name}`} onClose={onClose}>
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-xl bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-400">{error}</p>}
      <label className="block text-sm font-medium">Academy name<input required value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
      <label className="block text-sm font-medium">Subscription tier<select value={planTier} onChange={(e) => setPlanTier(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal"><option value="TRIAL">Tier 1 · Basic</option><option value="BASIC">Tier 2 · Standard</option><option value="PRO">Tier 3 · Premium</option></select></label>
      <label className="block text-sm font-medium">Account status<select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
      {status === 'INACTIVE' && <p className="rounded-xl bg-amber-50 dark:bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-400">Deactivating blocks all tenant users from signing in. Existing data (students, fees, attendance, etc.) is preserved.</p>}
      <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground disabled:opacity-60">{submitting && <Loader2 className="size-4 animate-spin" />}Save changes</button>
    </form>
  </Modal>
}

type TenantDetail = {
  id: string; name: string; slug: string; phone: string | null; address: string | null; description: string | null
  planTier: string; planLabel: string; status: string; createdAt: string
  users: { id: string; fullName: string; email: string; role: string; isActive: boolean }[]
  counts: { students: number; classes: number; invoices: number }
  fees: { totalDue: number; totalPaid: number }
}

const TENANT_TABS = [
  { key: 'overview', label: 'Overview', icon: Eye },
  { key: 'students', label: 'Students', icon: GraduationCap },
  { key: 'classes', label: 'Classes', icon: BookOpen },
  { key: 'staff', label: 'Staff', icon: UserRoundCog },
  { key: 'fees', label: 'Fees', icon: Receipt },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck2 },
  { key: 'website', label: 'Website', icon: Globe2 },
  { key: 'logs', label: 'Logs', icon: History },
] as const
type TenantTabKey = typeof TENANT_TABS[number]['key']

function TenantManageView({ tenantId, onExit, onManageTenant, impersonating }: { tenantId: string; onExit: () => void; onManageTenant: (id: string) => void; impersonating: boolean }) {
  const [tab, setTab] = useState<TenantTabKey>('overview')
  const [detail, setDetail] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  function load() {
    setLoading(true)
    fetch(`/api/super-admin/tenants/${tenantId}`).then((res) => res.json()).then((data) => setDetail(data.tenant)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [tenantId])

  if (loading || !detail) {
    return <div className="grid place-items-center rounded-2xl border bg-card p-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
  }

  return <div className="space-y-5">
    <button onClick={() => onManageTenant(tenantId)} disabled={impersonating} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-primary p-4 text-left text-primary-foreground shadow-sm disabled:opacity-60">
      <span className="flex items-center gap-3"><LogIn className="size-5 text-accent" /><span><span className="block text-sm font-semibold">Enter full tenant application</span><span className="block text-xs text-primary-foreground/70">Sign in as this academy's owner to use every module exactly as they do — Students, Fees, Attendance, Staff, Reports, Website, Settings, Admissions.</span></span></span>
      {impersonating ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <ArrowUpRight className="size-4 shrink-0" />}
    </button>

    <div className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1 shadow-sm">
      {TENANT_TABS.map((item) => (
        <button key={item.key} onClick={() => setTab(item.key)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${tab === item.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
          <item.icon className="size-4 shrink-0" />{item.label}
        </button>
      ))}
    </div>

    {tab === 'overview' && (
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Badge tone="neutral">{detail.planLabel}</Badge><Badge tone={detail.status === 'ACTIVE' ? 'green' : 'red'}>{detail.status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge></div>
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-secondary"><Pencil className="size-4" />Edit tenant</button>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Students</dt><dd className="mt-1 text-2xl font-semibold">{detail.counts.students}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Classes</dt><dd className="mt-1 text-2xl font-semibold">{detail.counts.classes}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Invoices</dt><dd className="mt-1 text-2xl font-semibold">{detail.counts.invoices}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Fees collected</dt><dd className="mt-1 text-2xl font-semibold">{currency(detail.fees.totalPaid)}</dd></div>
        </dl>
        <div className="mt-6 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <p>Slug: <span className="font-medium text-foreground">{detail.slug}</span></p>
          <p>Created: <span className="font-medium text-foreground">{new Date(detail.createdAt).toLocaleDateString()}</span></p>
          {detail.phone && <p>Phone: <span className="font-medium text-foreground">{detail.phone}</span></p>}
          {detail.address && <p>Address: <span className="font-medium text-foreground">{detail.address}</span></p>}
        </div>
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Users</h3>
          <div className="mt-2 divide-y">{detail.users.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0"><p className="truncate font-medium">{u.fullName}</p><p className="truncate text-xs text-muted-foreground">{u.email}</p></div>
              <div className="flex shrink-0 items-center gap-2"><Badge tone="neutral">{u.role}</Badge><Badge tone={u.isActive ? 'green' : 'neutral'}>{u.isActive ? 'Active' : 'Inactive'}</Badge></div>
            </div>
          ))}</div>
        </div>
      </section>
    )}
    {tab === 'students' && <TenantStudentsTab tenantId={tenantId} />}
    {tab === 'classes' && <TenantClassesTab tenantId={tenantId} />}
    {tab === 'staff' && <TenantStaffTab tenantId={tenantId} />}
    {tab === 'fees' && <TenantFeesTab tenantId={tenantId} />}
    {tab === 'attendance' && <TenantAttendanceTab tenantId={tenantId} />}
    {tab === 'website' && <TenantWebsiteTab tenantId={tenantId} />}
    {tab === 'logs' && <TenantLogsTab tenantId={tenantId} />}

    {editing && <EditTenantModal tenant={{ id: detail.id, name: detail.name, slug: detail.slug, planTier: detail.planTier, status: detail.status, ownerName: null, ownerEmail: null, studentCount: detail.counts.students, userCount: detail.users.length, createdAt: detail.createdAt }} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} />}
  </div>
}

function ReadOnlyNote() {
  return <p className="mb-4 rounded-xl bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">Quick read-only inspection. Use "Enter full tenant application" above to add, edit, or delete records.</p>
}

function TenantStudentsTab({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch(`/api/super-admin/tenants/${tenantId}/students`).then((r) => r.json()).then((d) => setRows(d.students ?? [])).finally(() => setLoading(false)) }, [tenantId])
  return <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
    <ReadOnlyNote />
    {loading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No students yet.</p> : (
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Class</th><th className="py-2 pr-4">Parent</th><th className="py-2 pr-4">Status</th><th className="py-2">Fee</th></tr></thead><tbody className="divide-y">{rows.map((s) => (
        <tr key={s.id}><td className="py-2 pr-4 font-medium">{s.name}</td><td className="py-2 pr-4 text-muted-foreground">{s.className}</td><td className="py-2 pr-4 text-muted-foreground">{s.parentName}</td><td className="py-2 pr-4"><Badge tone={s.status === 'ACTIVE' ? 'green' : 'neutral'}>{s.status}</Badge></td><td className="py-2">{currency(s.monthlyFee)}</td></tr>
      ))}</tbody></table></div>
    )}
  </section>
}

function TenantClassesTab({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch(`/api/super-admin/tenants/${tenantId}/classes`).then((r) => r.json()).then((d) => setRows(d.classes ?? [])).finally(() => setLoading(false)) }, [tenantId])
  return <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
    <ReadOnlyNote />
    {loading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No classes yet.</p> : (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rows.map((c) => (
        <div key={c.id} className="rounded-xl border p-4"><p className="font-semibold">{c.name} · {c.section}</p><p className="mt-1 text-sm text-muted-foreground">{c.studentCount} students · Teacher: {c.teacherName ?? 'Unassigned'}</p><p className="mt-2 text-sm font-medium text-primary">{currency(c.monthlyFee)}/mo</p></div>
      ))}</div>
    )}
  </section>
}

function TenantStaffTab({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch(`/api/super-admin/tenants/${tenantId}/staff`).then((r) => r.json()).then((d) => setRows(d.staff ?? [])).finally(() => setLoading(false)) }, [tenantId])
  return <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
    <ReadOnlyNote />
    {loading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No staff yet.</p> : (
      <div className="divide-y">{rows.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-2 py-3 text-sm"><div className="min-w-0"><p className="truncate font-medium">{s.fullName}</p><p className="truncate text-xs text-muted-foreground">{s.email}</p></div><div className="flex shrink-0 gap-2"><Badge tone="neutral">{s.role}</Badge><Badge tone={s.isActive ? 'green' : 'neutral'}>{s.isActive ? 'Active' : 'Inactive'}</Badge></div></div>
      ))}</div>
    )}
  </section>
}

function TenantFeesTab({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch(`/api/super-admin/tenants/${tenantId}/fees`).then((r) => r.json()).then((d) => setRows(d.invoices ?? [])).finally(() => setLoading(false)) }, [tenantId])
  return <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
    <ReadOnlyNote />
    {loading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No invoices yet.</p> : (
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-2 pr-4">Student</th><th className="py-2 pr-4">Month</th><th className="py-2 pr-4">Due</th><th className="py-2 pr-4">Paid</th><th className="py-2">Status</th></tr></thead><tbody className="divide-y">{rows.map((inv) => (
        <tr key={inv.id}><td className="py-2 pr-4 font-medium">{inv.studentName}</td><td className="py-2 pr-4 text-muted-foreground">{inv.month}</td><td className="py-2 pr-4 text-muted-foreground">{currency(inv.amountDue)}</td><td className="py-2 pr-4 text-muted-foreground">{currency(inv.amountPaid)}</td><td className="py-2"><Badge tone={inv.status === 'PAID' ? 'green' : inv.status === 'OVERDUE' ? 'red' : 'amber'}>{inv.status}</Badge></td></tr>
      ))}</tbody></table></div>
    )}
  </section>
}

function TenantAttendanceTab({ tenantId }: { tenantId: string }) {
  const [today, setToday] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch(`/api/super-admin/tenants/${tenantId}/attendance`).then((r) => r.json()).then((d) => setToday(d.today)).finally(() => setLoading(false)) }, [tenantId])
  return <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
    <h3 className="font-semibold">Today's attendance</h3>
    {loading || !today ? <Loader2 className="mt-4 size-5 animate-spin text-muted-foreground" /> : (
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><p className="text-2xl font-semibold">{today.present}</p><p className="text-xs text-muted-foreground">Present</p></div>
        <div><p className="text-2xl font-semibold">{today.absent}</p><p className="text-xs text-muted-foreground">Absent</p></div>
        <div><p className="text-2xl font-semibold">{today.notMarked}</p><p className="text-xs text-muted-foreground">Not marked</p></div>
        <div><p className="text-2xl font-semibold">{today.totalActiveStudents}</p><p className="text-xs text-muted-foreground">Active students</p></div>
      </div>
    )}
  </section>
}

function TenantWebsiteTab({ tenantId }: { tenantId: string }) {
  const [site, setSite] = useState<any>(null)
  const [tagline, setTagline] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    fetch(`/api/super-admin/tenants/${tenantId}/website`).then((r) => r.json()).then((d) => { setSite(d); setTagline(d.tagline ?? '') }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [tenantId])

  async function handleSave() {
    setSaving(true)
    try {
      await fetch(`/api/super-admin/tenants/${tenantId}/website`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'content', data: { tagline, cards: site.cards, features: site.features } }),
      })
      load()
    } finally {
      setSaving(false)
    }
  }

  if (loading || !site) return <Loader2 className="size-5 animate-spin text-muted-foreground" />
  return <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
    <div className="flex items-center justify-between"><h3 className="font-semibold">Website content</h3><a href={`/site/${site.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"><ArrowUpRight className="size-3.5" />View live site</a></div>
    <label className="mt-4 block text-sm font-medium">Tagline<textarea value={tagline} onChange={(e) => setTagline(e.target.value)} rows={2} className="mt-2 w-full resize-none rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
    <p className="mt-3 text-xs text-muted-foreground">{site.testimonials?.length ?? 0} testimonial(s) · {site.faqs?.length ?? 0} FAQ(s) · {site.cards?.length ?? 0} highlight card(s). Edit full content from the tenant's own Website module for the richest editor.</p>
    <button onClick={handleSave} disabled={saving} className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60">{saving && <Loader2 className="size-4 animate-spin" />}Save tagline</button>
  </section>
}

function TenantLogsTab({ tenantId }: { tenantId: string }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch(`/api/super-admin/tenants/${tenantId}/logs`).then((r) => r.json()).then((d) => setRows(d.logs ?? [])).finally(() => setLoading(false)) }, [tenantId])
  return <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
    {loading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> : (
      <div className="divide-y">{rows.map((log) => (
        <div key={log.id} className="py-3 text-sm">
          <p><span className="font-medium">{log.actorName}</span> {log.actorType === 'SUPER_ADMIN' && <Badge tone="amber">Super Admin</Badge>} <span className="text-muted-foreground">{humanizeAction(log.action)}</span></p>
          <p className="mt-0.5 text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</p>
        </div>
      ))}</div>
    )}
  </section>
}

type PlanRequestRow = {
  id: string; academyId: string; tenantName: string; currentTier: string; requestedTier: string; status: string
  requestedByName: string; requestedByEmail: string; adminNote: string | null; reviewedByName: string | null
  reviewedAt: string | null; createdAt: string
}

function planRequestStatusTone(status: string) {
  if (status === 'APPROVED') return 'green'
  if (status === 'REJECTED') return 'red'
  if (status === 'CANCELLED') return 'neutral'
  return 'amber'
}

function PlanRequestsView() {
  const [requests, setRequests] = useState<PlanRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'all'>('PENDING')
  const [reviewing, setReviewing] = useState<PlanRequestRow | null>(null)

  function load() {
    setLoading(true)
    fetch('/api/super-admin/plan-requests').then((res) => res.json()).then((data) => setRequests(data.requests ?? [])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const filtered = statusFilter === 'all' ? requests : requests.filter((r) => r.status === statusFilter)

  return <section className="rounded-2xl border bg-card shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
      <div><h2 className="text-xl font-semibold">Plan upgrade requests</h2><p className="mt-1 text-sm text-muted-foreground">Tenants requesting a higher subscription tier.</p></div>
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="rounded-xl border bg-background px-3 py-2 text-sm"><option value="PENDING">Pending only</option><option value="all">All requests</option></select>
    </div>
    {loading ? (
      <div className="grid place-items-center p-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
    ) : filtered.length === 0 ? (
      <div className="grid place-items-center p-16 text-center"><ArrowUpCircle className="size-10 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">No {statusFilter === 'PENDING' ? 'pending ' : ''}requests</h3></div>
    ) : (
      <>
      {/* Mobile: card list */}
      <div className="divide-y sm:hidden">{filtered.map((r) => (
        <div key={r.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate font-medium">{r.tenantName}</p>
            <Badge tone={planRequestStatusTone(r.status)}>{r.status[0] + r.status.slice(1).toLowerCase()}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="neutral">{tierBadgeLabel(r.currentTier)}</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge tone="neutral">{tierBadgeLabel(r.requestedTier)}</Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">By {r.requestedByName} · {new Date(r.createdAt).toLocaleDateString()}</p>
          {r.status === 'PENDING' && <button onClick={() => setReviewing(r)} className="mt-3 inline-flex rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Review</button>}
        </div>
      ))}</div>
      {/* Tablet & up: table */}
      <div className="hidden overflow-x-auto sm:block"><table className="w-full text-left text-sm"><thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground"><tr>
        <th className="px-5 py-3 font-medium">Tenant</th><th className="px-5 py-3 font-medium">Current</th><th className="px-5 py-3 font-medium">Requested</th><th className="px-5 py-3 font-medium">Requested by</th><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Action</th>
      </tr></thead><tbody className="divide-y">{filtered.map((r) => (
        <tr key={r.id}>
          <td className="px-5 py-4 font-medium">{r.tenantName}</td>
          <td className="px-5 py-4"><Badge tone="neutral">{tierBadgeLabel(r.currentTier)}</Badge></td>
          <td className="px-5 py-4"><Badge tone="neutral">{tierBadgeLabel(r.requestedTier)}</Badge></td>
          <td className="px-5 py-4 text-muted-foreground">{r.requestedByName}</td>
          <td className="px-5 py-4 text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
          <td className="px-5 py-4"><Badge tone={planRequestStatusTone(r.status)}>{r.status[0] + r.status.slice(1).toLowerCase()}</Badge></td>
          <td className="px-5 py-4 text-right">{r.status === 'PENDING' ? <button onClick={() => setReviewing(r)} className="text-sm font-semibold text-primary">Review</button> : <span className="text-xs text-muted-foreground">—</span>}</td>
        </tr>
      ))}</tbody></table></div>
      </>
    )}
    {reviewing && <PlanRequestReviewModal request={reviewing} onClose={() => setReviewing(null)} onReviewed={() => { setReviewing(null); load() }} />}
  </section>
}

function PlanRequestReviewModal({ request, onClose, onReviewed }: { request: PlanRequestRow; onClose: () => void; onReviewed: () => void }) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState<'APPROVED' | 'REJECTED' | null>(null)
  const [error, setError] = useState('')

  async function handleDecision(decision: 'APPROVED' | 'REJECTED') {
    setSubmitting(decision)
    setError('')
    try {
      const res = await fetch(`/api/super-admin/plan-requests/${request.id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); setSubmitting(null); return }
      onReviewed()
    } catch {
      setError('Could not reach the server.')
      setSubmitting(null)
    }
  }

  return <Modal title={`Review request — ${request.tenantName}`} onClose={onClose}>
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-400">{error}</p>}
      <div className="grid gap-3 rounded-xl border p-4 text-sm sm:grid-cols-2">
        <p>Tenant: <span className="font-medium text-foreground">{request.tenantName}</span></p>
        <p>Requested by: <span className="font-medium text-foreground">{request.requestedByName}</span></p>
        <p>Current plan: <Badge tone="neutral">{tierBadgeLabel(request.currentTier)}</Badge></p>
        <p>Requested plan: <Badge tone="neutral">{tierBadgeLabel(request.requestedTier)}</Badge></p>
        <p className="sm:col-span-2">Requested: <span className="font-medium text-foreground">{new Date(request.createdAt).toLocaleString()}</span></p>
      </div>
      <label className="block text-sm font-medium">Admin note (optional)<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-2 w-full resize-none rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="Visible to the tenant if you choose to share context." /></label>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => handleDecision('REJECTED')} disabled={submitting !== null} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-600 disabled:opacity-60 dark:text-rose-400">{submitting === 'REJECTED' && <Loader2 className="size-4 animate-spin" />}Reject</button>
        <button type="button" onClick={() => handleDecision('APPROVED')} disabled={submitting !== null} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60">{submitting === 'APPROVED' && <Loader2 className="size-4 animate-spin" />}Approve</button>
      </div>
    </div>
  </Modal>
}

function PlansView() {
  const [tiers, setTiers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch('/api/super-admin/plans').then((r) => r.json()).then((d) => setTiers(d.tiers ?? [])).finally(() => setLoading(false)) }, [])
  if (loading) return <Loader2 className="size-5 animate-spin text-muted-foreground" />
  return <div className="grid gap-4 sm:grid-cols-3">
    {tiers.map((tier) => (
      <div key={tier.tier} className="rounded-2xl border bg-card p-5 shadow-sm">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tierToneClass(tier.tier)}`}>Tier {tier.number}</span>
        <h3 className="mt-3 text-lg font-semibold">{tier.businessName}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Up to {tier.staffLimit} staff account{tier.staffLimit === 1 ? '' : 's'}</p>
        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex items-center gap-2"><Check className="size-3.5 text-emerald-600" />Core student, class & attendance management</li>
          {tier.features.length === 0 && <li className="text-muted-foreground">No add-on modules included</li>}
          {tier.features.map((f: any) => <li key={f.key} className="flex items-center gap-2"><Check className="size-3.5 text-emerald-600" />{f.label}</li>)}
        </ul>
      </div>
    ))}
    <p className="text-xs text-muted-foreground sm:col-span-3">Feature-to-tier mapping is centrally defined in <code>lib/tiers.ts</code> and enforced both in the UI and on every relevant API route — changing a tier's features there updates access everywhere at once.</p>
  </div>
}

function LogsView() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<'all' | 'platform'>('all')
  useEffect(() => {
    setLoading(true)
    fetch(`/api/super-admin/logs${scope === 'platform' ? '?scope=platform' : ''}`).then((r) => r.json()).then((d) => setRows(d.logs ?? [])).finally(() => setLoading(false))
  }, [scope])
  return <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
    <div className="flex items-center justify-between"><h2 className="font-semibold">Activity logs</h2>
      <select value={scope} onChange={(e) => setScope(e.target.value as any)} className="rounded-xl border bg-background px-3 py-2 text-sm"><option value="all">All activity</option><option value="platform">Super Admin actions only</option></select>
    </div>
    {loading ? <Loader2 className="mt-4 size-5 animate-spin text-muted-foreground" /> : rows.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No activity recorded yet.</p> : (
      <div className="mt-4 divide-y">{rows.map((log) => (
        <div key={log.id} className="py-3 text-sm">
          <p><span className="font-medium">{log.actorName}</span> {log.actorType === 'SUPER_ADMIN' && <Badge tone="amber">Super Admin</Badge>} <span className="text-muted-foreground">{humanizeAction(log.action)}</span>{log.tenantName && <> · <span className="font-medium">{log.tenantName}</span></>}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</p>
        </div>
      ))}</div>
    )}
  </section>
}

function PlatformSettingsView() {
  return <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
    <h2 className="font-semibold">Platform settings</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
      Platform-level configuration (subscription tiers, feature entitlements, and staff limits) lives in <code>lib/tiers.ts</code> as a single source of truth, distinct from each tenant's own Settings. This keeps plan logic centralized instead of scattered across modules.
    </p>
    <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
      Tenant-specific settings (academy profile, branding, receipts, website) remain inside each tenant's own Settings module and are only reachable here through <b>Manage → Website</b> for public content, or by editing the tenant record directly.
    </p>
  </section>
}
