'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight, Bell, BookOpen, CalendarCheck2, ChevronDown, CircleDollarSign,
  Clock3, GraduationCap, LayoutDashboard, Menu,
  Plus, Search, Settings, ShieldCheck, Sparkles, Users, X, Check, LockKeyhole,
  LogOut, Globe2, Receipt, UserRoundCog, Eye, EyeOff, Loader2,
  Mail, MessageSquare, MessageCircle, Copy, Layers, FileText, CalendarDays,
  Sun, Moon, Monitor, BarChart3, FileDown, ChevronLeft, ChevronRight,
  Building2, CreditCard, History, Download, RotateCcw,
  Pencil, Trash2, UserX, UserCheck,
  Newspaper, Quote, UserPlus, ImagePlus, ArrowLeft,
} from 'lucide-react'
import { LanguageProvider, useLanguage, type Language } from '@/lib/i18n'
import { ThemeProvider, useTheme, type ThemeMode } from '@/lib/theme'
import { renderTemplate, REMINDER_TEMPLATE_TOKENS } from '@/lib/settings-content'
import { tierLabel as planTierLabel, tierNumber, tierBusinessName } from '@/lib/tiers'

type ActiveKey = 'dashboard' | 'students' | 'classes' | 'fees' | 'attendance' | 'staff' | 'website' | 'reports' | 'settings'

const nav: { key: ActiveKey; icon: any }[] = [
  { key: 'dashboard', icon: LayoutDashboard },
  { key: 'students', icon: Users },
  { key: 'classes', icon: BookOpen },
  { key: 'fees', icon: Receipt },
  { key: 'attendance', icon: CalendarCheck2 },
  { key: 'staff', icon: UserRoundCog },
  { key: 'website', icon: Globe2 },
  { key: 'reports', icon: BarChart3 },
]
type CurrentUser = { id: string; email: string; fullName: string; role: string }
type CurrentAcademy = { id: string; name: string; slug: string; planTier: string; trialEndsAt: string | null; reminderTemplate: string | null }

type DashboardStats = {
  totalStudents: number
  studentsAddedThisMonth: number
  feesThisMonth: number
  feesChangePct: number | null
  attendanceRateToday: number | null
  presentToday: number
  absentToday: number
  lateToday: number
  excusedToday: number
  attendanceMarkedToday: number
  attendanceNotMarkedToday: number
  pendingAmount: number
  pendingInvoiceCount: number
}

type StudentSetup = {
  feePaid: boolean
  attendanceMarked: boolean
  parentEmailOnFile: boolean
  dateOfBirthOnFile: boolean
}

type RecentStudent = {
  id: string
  name: string
  className: string
  section: string
  feeStatus: string
  feeMonth: string | null
  balance: number
  parentName: string
  parentPhone: string
  parentEmail: string | null
  admissionDate: string
  attendanceRate: number | null
  setup: StudentSetup
}

type DashboardSummary = {
  newEnrollmentsThisWeek: number
  collectionRatePct: number | null
  attendanceCoveragePct: number | null
}

type WeeklyAttendanceDay = { date: string; pct: number | null }
type AcademyHealth = { percent: number; missing: string[] }

type ClassOption = { id: string; name: string; section: string; monthlyFee: number }

type StudentRow = {
  id: string
  name: string
  parentName: string
  parentPhone: string
  classId: string
  className: string
  status: string
  monthlyFee: number
  feeStatus: string
  attendanceRate: number | null
}

type StudentDetail = {
  id: string
  name: string
  parentName: string
  parentPhone: string
  parentEmail: string | null
  dateOfBirth: string | null
  admissionDate: string
  classId: string
  className: string
  status: string
  monthlyFee: number
  feeStatus?: string
  attendanceRate?: number | null
}

type InvoiceRow = {
  id: string
  studentId: string
  studentName: string
  parentName: string
  parentPhone: string
  className: string
  month: string
  amountDue: number
  amountPaid: number
  balance: number
  status: string
  dueDate: string
  lastPaymentId: string | null
  lastReceiptNumber: string | null
}

type ClassRow = {
  id: string
  name: string
  section: string
  monthlyFee: number
  teacherId: string | null
  teacherName: string | null
  studentCount: number
  isActive: boolean
  publicVisible: boolean
  publicDescription: string | null
  publicSubjects: string | null
  electiveSubjects: { name: string; monthlyFee: number }[]
}

type AttendanceStudentRow = {
  id: string
  name: string
  classId: string
  className: string
  status: string | null
}

type NotificationItem = { id: string; type: string; severity: 'high' | 'medium' | 'low' | 'info'; n?: number; label?: string }

type StaffRow = { id: string; fullName: string; email: string; phone: string | null; role: string; isActive: boolean; createdAt: string; showOnWebsite?: boolean; publicTitle?: string | null; publicBio?: string | null; publicPhotoUrl?: string | null }

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

function currency(amount: number) {
  return `Rs ${Math.round(amount).toLocaleString()}`
}

type FeesFilter = 'all' | 'unpaid'

const ROMAN_WEEKDAYS = ['Itwar', 'Peer', 'Mangal', 'Budh', 'Jumeraat', 'Jumma', 'Hafta']
const ROMAN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function formatFullDate(date: Date, language: Language) {
  if (language === 'ur') {
    return `${ROMAN_WEEKDAYS[date.getDay()]}, ${date.getDate()} ${ROMAN_MONTHS[date.getMonth()]} ${date.getFullYear()}`
  }
  return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function monthLabel(month: string, language: Language) {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return month
  const monthIndex = Number(match[2]) - 1
  if (language === 'ur') return `${ROMAN_MONTHS[monthIndex]} ${match[1]}`
  return new Date(Number(match[1]), monthIndex, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handle(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onOutside])
  return ref
}

function Brand({ compact = false, academyName }: { compact?: boolean; academyName?: string }) {
  const { t } = useLanguage()
  return <div className="flex items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><GraduationCap className="size-5" /></div>{!compact && <div className="min-w-0"><p className="truncate font-semibold tracking-tight">{t('brand.name')}</p><p className="truncate text-xs text-muted-foreground">{academyName ?? t('brand.loading')}</p></div>}</div>
}
function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone === 'green' ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : tone === 'amber' ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400' : tone === 'red' ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400' : 'bg-secondary text-secondary-foreground'}`}>{children}</span> }
function Stat({ icon: Icon, label, value, detail, tone = 'indigo', onClick }: { icon: any; label: string; value: string; detail: string; tone?: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return <Tag onClick={onClick} className={`rounded-2xl border bg-card p-4 text-left shadow-sm sm:p-5 ${onClick ? 'cursor-pointer transition hover:border-primary hover:shadow-md' : ''}`}><div className="flex items-start justify-between"><div className={`grid size-10 place-items-center rounded-xl ${tone === 'gold' ? 'bg-accent text-accent-foreground' : 'bg-indigo-50 text-primary dark:bg-indigo-500/15'}`}><Icon className="size-5" /></div><ArrowUpRight className="size-4 text-muted-foreground" /></div><p className="mt-5 text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></Tag>
}

function feeStatusTone(status: string) {
  if (status === 'PAID') return 'green'
  if (status === 'OVERDUE') return 'red'
  return 'amber'
}
function feeStatusLabel(status: string, t: (key: string) => string) {
  if (status === 'PAID') return t('status.paid')
  if (status === 'OVERDUE') return t('status.overdue')
  if (status === 'PARTIAL') return t('status.partial')
  return t('status.pending')
}

function studentStatusTone(status: string) {
  if (status === 'ACTIVE') return 'green'
  if (status === 'GRADUATED') return 'neutral'
  return 'amber'
}
function studentStatusLabel(status: string, t: (key: string) => string) {
  if (status === 'ACTIVE') return t('studentStatus.active')
  if (status === 'GRADUATED') return t('studentStatus.graduated')
  return t('studentStatus.inactive')
}

function tierBadgeLabel(planTier: string, t: (key: string) => string) {
  if (planTier === 'PRO') return t('plan.tier3')
  if (planTier === 'BASIC') return t('plan.tier2')
  return t('plan.tier1')
}

export default function AcademyManager() {
  return <LanguageProvider><ThemeProvider><AcademyManagerApp /></ThemeProvider></LanguageProvider>
}

function AcademyManagerApp() {
  const { t, language, setLanguage } = useLanguage()
  const { theme, setTheme } = useTheme()

  const [authState, setAuthState] = useState<'loading' | 'signed-out' | 'signed-in'>('loading')
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [currentAcademy, setCurrentAcademy] = useState<CurrentAcademy | null>(null)

  const [active, setActive] = useState<ActiveKey>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [toast, setToast] = useState('')

  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null)
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([])
  const [weeklyAttendance, setWeeklyAttendance] = useState<WeeklyAttendanceDay[]>([])
  const [academyHealth, setAcademyHealth] = useState<AcademyHealth | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')

  const [studentsList, setStudentsList] = useState<StudentRow[]>([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentsError, setStudentsError] = useState('')
  const [dataVersion, setDataVersion] = useState(0)

  const [invoicesList, setInvoicesList] = useState<InvoiceRow[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [invoicesError, setInvoicesError] = useState('')

  const [classesList, setClassesList] = useState<ClassRow[]>([])
  const [classesLoading, setClassesLoading] = useState(false)
  const [classesError, setClassesError] = useState('')
  const [showAddClass, setShowAddClass] = useState(false)
  const [showAddStaff, setShowAddStaff] = useState(false)

  const [attendanceDate, setAttendanceDate] = useState(() => todayKey())
  const [attendanceStudents, setAttendanceStudents] = useState<AttendanceStudentRow[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceError, setAttendanceError] = useState('')
  const [markingId, setMarkingId] = useState<string | null>(null)

  const [paymentModal, setPaymentModal] = useState<'closed' | 'picker' | InvoiceRow>('closed')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [feesFilter, setFeesFilter] = useState<FeesFilter>('all')

  const [studentsCanManage, setStudentsCanManage] = useState(false)
  const [studentsSearchSeed, setStudentsSearchSeed] = useState('')
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null)
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null)
  const [deactivatingStudent, setDeactivatingStudent] = useState<StudentRow | null>(null)
  const [deletingStudent, setDeletingStudent] = useState<StudentRow | null>(null)
  const [studentActionLoading, setStudentActionLoading] = useState(false)
  const [studentActionError, setStudentActionError] = useState('')

  const [classesCanManage, setClassesCanManage] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassRow | null>(null)
  const [deactivatingClass, setDeactivatingClass] = useState<ClassRow | null>(null)
  const [deletingClass, setDeletingClass] = useState<ClassRow | null>(null)
  const [classActionLoading, setClassActionLoading] = useState(false)
  const [classActionError, setClassActionError] = useState('')

  const [impersonation, setImpersonation] = useState<{ active: boolean; superAdminName: string; tenantName: string } | null>(null)

  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(''), 2600) }

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.user) {
          setCurrentUser(data.user)
          setCurrentAcademy(data.academy)
          setImpersonation(data.impersonation ?? null)
          setAuthState('signed-in')
        } else {
          setAuthState('signed-out')
        }
      })
      .catch(() => { if (!cancelled) setAuthState('signed-out') })
    return () => { cancelled = true }
  }, [])

  async function handleExitImpersonation() {
    await fetch('/api/super-admin/impersonation/exit', { method: 'POST' })
    window.location.href = '/super-admin'
  }

  useEffect(() => {
    if (authState !== 'signed-in' || active !== 'dashboard') return
    let cancelled = false
    setDashboardLoading(true)
    setDashboardError('')
    fetch('/api/dashboard')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load dashboard.')
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setDashboardStats(data.stats)
        setDashboardSummary(data.summary)
        setRecentStudents(data.recentStudents)
        setWeeklyAttendance(data.weeklyAttendance)
        setAcademyHealth(data.health)
      })
      .catch(() => { if (!cancelled) setDashboardError(t('toast.couldNotReachServer')) })
      .finally(() => { if (!cancelled) setDashboardLoading(false) })
    return () => { cancelled = true }
  }, [authState, active, dataVersion, t])

  useEffect(() => {
    if (authState !== 'signed-in' || active !== 'students') return
    let cancelled = false
    setStudentsLoading(true)
    setStudentsError('')
    fetch('/api/students')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load students.')
        return res.json()
      })
      .then((data) => { if (!cancelled) { setStudentsList(data.students); setStudentsCanManage(Boolean(data.canManage)) } })
      .catch(() => { if (!cancelled) setStudentsError(t('toast.couldNotReachServer')) })
      .finally(() => { if (!cancelled) setStudentsLoading(false) })
    return () => { cancelled = true }
  }, [authState, active, dataVersion, t])

  useEffect(() => {
    if (authState !== 'signed-in' || active !== 'fees') return
    let cancelled = false
    setInvoicesLoading(true)
    setInvoicesError('')
    fetch('/api/invoices')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load invoices.')
        return res.json()
      })
      .then((data) => { if (!cancelled) setInvoicesList(data.invoices) })
      .catch(() => { if (!cancelled) setInvoicesError(t('toast.couldNotReachServer')) })
      .finally(() => { if (!cancelled) setInvoicesLoading(false) })
    return () => { cancelled = true }
  }, [authState, active, dataVersion, t])

  useEffect(() => {
    if (authState !== 'signed-in' || active !== 'classes') return
    let cancelled = false
    setClassesLoading(true)
    setClassesError('')
    fetch('/api/classes')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load classes.')
        return res.json()
      })
      .then((data) => { if (!cancelled) { setClassesList(data.classes); setClassesCanManage(Boolean(data.canManage)) } })
      .catch(() => { if (!cancelled) setClassesError(t('toast.couldNotReachServer')) })
      .finally(() => { if (!cancelled) setClassesLoading(false) })
    return () => { cancelled = true }
  }, [authState, active, dataVersion, t])

  useEffect(() => {
    if (authState !== 'signed-in' || active !== 'attendance') return
    let cancelled = false
    setAttendanceLoading(true)
    setAttendanceError('')
    fetch(`/api/attendance?date=${attendanceDate}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load attendance.')
        return res.json()
      })
      .then((data) => { if (!cancelled) setAttendanceStudents(data.students) })
      .catch(() => { if (!cancelled) setAttendanceError(t('toast.couldNotReachServer')) })
      .finally(() => { if (!cancelled) setAttendanceLoading(false) })
    return () => { cancelled = true }
  }, [authState, active, attendanceDate, dataVersion, t])

  useEffect(() => {
    if (authState !== 'signed-in') return
    let cancelled = false
    fetch('/api/notifications')
      .then((res) => (res.ok ? res.json() : { notifications: [] }))
      .then((data) => { if (!cancelled) setNotifications(data.notifications ?? []) })
      .catch(() => { if (!cancelled) setNotifications([]) })
    return () => { cancelled = true }
  }, [authState, dataVersion])

  function handleStudentSaved(_student: StudentRow, isNew: boolean) {
    setDataVersion((v) => v + 1)
    notify(isNew ? t('toast.studentAdded') : t('toast.studentUpdated'))
  }

  async function handleConfirmDeactivateStudent() {
    if (!deactivatingStudent) return
    setStudentActionLoading(true)
    setStudentActionError('')
    try {
      const nextStatus = deactivatingStudent.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE'
      const res = await fetch(`/api/students/${deactivatingStudent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setStudentActionError(data.error ?? t('toast.couldNotReachServer')); return }
      setDataVersion((v) => v + 1)
      notify(nextStatus === 'INACTIVE' ? t('toast.studentDeactivated') : t('toast.studentActivated'))
      setDeactivatingStudent(null)
    } catch {
      setStudentActionError(t('toast.couldNotReachServer'))
    } finally {
      setStudentActionLoading(false)
    }
  }

  async function handleConfirmDeleteStudent() {
    if (!deletingStudent) return
    setStudentActionLoading(true)
    setStudentActionError('')
    try {
      const res = await fetch(`/api/students/${deletingStudent.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setStudentActionError(data.error ?? t('toast.couldNotReachServer')); return }
      setDataVersion((v) => v + 1)
      notify(t('toast.studentDeleted'))
      setDeletingStudent(null)
    } catch {
      setStudentActionError(t('toast.couldNotReachServer'))
    } finally {
      setStudentActionLoading(false)
    }
  }

  function handleClassSaved(_cls: ClassRow, isNew: boolean) {
    setDataVersion((v) => v + 1)
    notify(isNew ? t('toast.classAdded') : t('toast.classUpdated'))
  }

  function handleViewClassStudents(cls: ClassRow) {
    setStudentsSearchSeed(`${cls.name} · ${cls.section}`)
    goToModule('students')
  }

  async function handleConfirmToggleClassActive() {
    if (!deactivatingClass) return
    setClassActionLoading(true)
    setClassActionError('')
    try {
      const nextActive = !deactivatingClass.isActive
      const res = await fetch(`/api/classes/${deactivatingClass.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setClassActionError(data.error ?? t('toast.couldNotReachServer')); return }
      setDataVersion((v) => v + 1)
      notify(nextActive ? t('toast.classActivated') : t('toast.classDeactivated'))
      setDeactivatingClass(null)
    } catch {
      setClassActionError(t('toast.couldNotReachServer'))
    } finally {
      setClassActionLoading(false)
    }
  }

  async function handleConfirmDeleteClass() {
    if (!deletingClass) return
    setClassActionLoading(true)
    setClassActionError('')
    try {
      const res = await fetch(`/api/classes/${deletingClass.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setClassActionError(data.error ?? t('toast.couldNotReachServer')); return }
      setDataVersion((v) => v + 1)
      notify(t('toast.classDeleted'))
      setDeletingClass(null)
    } catch {
      setClassActionError(t('toast.couldNotReachServer'))
    } finally {
      setClassActionLoading(false)
    }
  }

  function handleStaffAdded() {
    setDataVersion((v) => v + 1)
    notify(t('toast.staffAdded'))
  }

  function handlePaymentRecorded() {
    setDataVersion((v) => v + 1)
  }

  async function handleMarkAttendance(studentId: string, classId: string, status: string) {
    setMarkingId(studentId)
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, date: attendanceDate, status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        notify(data.error ?? t('toast.couldNotSaveAttendance'))
        return
      }
      setAttendanceStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, status } : s)))
      setDataVersion((v) => v + 1)
    } catch {
      notify(t('toast.couldNotReachServer'))
    } finally {
      setMarkingId(null)
    }
  }

  function goToModule(key: ActiveKey, opts?: { feesFilter?: FeesFilter }) {
    if (key === 'fees') setFeesFilter(opts?.feesFilter ?? 'all')
    if (key === 'attendance') setAttendanceDate(todayKey())
    setActive(key)
    setMobileOpen(false)
  }

  function handleNotificationClick(notif: NotificationItem) {
    if (notif.type === 'overdueFees' || notif.type === 'pendingFees') goToModule('fees', { feesFilter: 'unpaid' })
    else if (notif.type === 'attendanceMissing') goToModule('attendance')
    else if (notif.type === 'newStudents') goToModule('students')
    else if (notif.type === 'trialEnding') goToModule('settings')
    else if (notif.type === 'planRequestPending' || notif.type === 'planRequestApproved' || notif.type === 'planRequestRejected') goToModule('settings')
  }

  function handleSignedIn(user: CurrentUser, academy: CurrentAcademy) {
    setCurrentUser(user)
    setCurrentAcademy(academy)
    setAuthState('signed-in')
  }

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setCurrentUser(null)
    setCurrentAcademy(null)
    setAuthState('signed-out')
    setShowAccount(false)
    setActive('dashboard')
  }

  const firstName = currentUser?.fullName.split(' ')[0] ?? ''
  const hour = new Date().getHours()
  const greetingKey = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const title = active === 'dashboard' ? `${t(`greeting.${greetingKey}`)}, ${firstName}` : t(`nav.${active}`)
  const subtitle = active === 'dashboard' ? t('subtitle.dashboard') : active === 'settings' ? t('settings.subtitle') : t('subtitle.module', { module: t(`nav.${active}`).toLowerCase() })
  const todayLabel = useMemo(() => formatFullDate(new Date(), language), [language])

  const trialDaysLeft = useMemo(() => {
    if (!currentAcademy?.trialEndsAt) return null
    const diff = new Date(currentAcademy.trialEndsAt).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }, [currentAcademy])

  const headerAction = active === 'classes'
    ? { label: t('action.addClass'), icon: Plus, onClick: () => setShowAddClass(true) }
    : active === 'fees'
      ? { label: t('action.recordPayment'), icon: Receipt, onClick: () => setPaymentModal('picker') }
      : active === 'staff'
        ? { label: t('action.addStaff'), icon: Plus, onClick: () => setShowAddStaff(true) }
        : { label: t('action.addStudent'), icon: Plus, onClick: () => setShowAdd(true) }

  if (authState === 'loading') {
    return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  if (authState === 'signed-out') {
    return <SignInScreen onSignedIn={handleSignedIn} />
  }

  return <div className="min-h-screen bg-background text-foreground">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r bg-card p-5 transition-transform lg:w-64 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between gap-2"><Brand academyName={currentAcademy?.name} /><button className="shrink-0 lg:hidden" onClick={() => setMobileOpen(false)} aria-label={t('modal.close')}><X className="size-5" /></button></div>
      <div className="mt-10 flex flex-col gap-1">
        {nav.map(({ key, icon: Icon }) => <button key={key} onClick={() => goToModule(key)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${active === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}><Icon className="size-4 shrink-0" /><span className="truncate">{t(`nav.${key}`)}</span></button>)}
        <div className="my-4 border-t" />
        <button onClick={() => { setActive('settings'); setMobileOpen(false) }} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${active === 'settings' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary'}`}><Settings className="size-4 shrink-0" />{t('nav.settings')}</button>
      </div>
      {trialDaysLeft !== null ? (
        <div className="mt-auto rounded-2xl bg-secondary p-4"><div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="size-4 shrink-0 text-accent-foreground" />{t('trial.daysLeft', { n: trialDaysLeft })}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{t('trial.unlock')}</p><button onClick={() => notify(t('trial.upgradeRequested'))} className="mt-3 text-xs font-semibold text-primary">{t('trial.viewPlans')} <ArrowUpRight className="ml-1 inline size-3" /></button></div>
      ) : currentAcademy && (
        <div className="mt-auto rounded-2xl bg-secondary p-4"><p className="text-sm font-medium">{tierBadgeLabel(currentAcademy.planTier, t)}</p></div>
      )}
    </aside>
    {mobileOpen && <div className="fixed inset-0 z-30 bg-foreground/30 lg:hidden" onClick={() => setMobileOpen(false)} />}
    <div className="lg:pl-64">
      {impersonation?.active && (
        <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 bg-primary px-3 py-2 text-sm text-primary-foreground sm:px-4 md:px-8">
          <span className="flex min-w-0 items-center gap-2"><ShieldCheck className="size-4 shrink-0 text-accent" /><span className="truncate">SUPER ADMIN · Managing: <b>{impersonation.tenantName}</b></span></span>
          <button onClick={handleExitImpersonation} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold hover:bg-primary-foreground/20"><ArrowLeft className="size-3.5" />Exit tenant</button>
        </div>
      )}
      <header className={`sticky z-30 flex h-16 items-center justify-between gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-4 md:px-8 ${impersonation?.active ? 'top-9' : 'top-0'}`}>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button onClick={() => setMobileOpen(true)} className="shrink-0 lg:hidden" aria-label="Open menu"><Menu className="size-5" /></button>
          <div className="min-w-0 lg:hidden"><Brand compact /></div>
          <div className="hidden min-w-0 items-center gap-2 text-sm text-muted-foreground lg:flex"><span className="truncate">{currentAcademy?.name}</span><ChevronDown className="size-4 shrink-0" /></div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <LanguageToggle language={language} setLanguage={setLanguage} />
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <NotificationsBell notifications={notifications} onSelect={handleNotificationClick} />
          <button onClick={() => setShowAccount(true)} className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" aria-label={t('account.title')}>{currentUser ? initialsOf(currentUser.fullName).toUpperCase() : 'AM'}</button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 md:p-8">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0"><p className="mb-2 text-sm font-medium text-primary">{todayLabel}</p><h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">{title}</h1><p className="mt-2 text-sm text-muted-foreground md:text-base">{subtitle}</p></div>
          <div className="flex flex-wrap gap-2"><button onClick={() => setShowDemo(true)} className="rounded-xl border bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary">{t('takeTour')}</button>{active !== 'website' && active !== 'reports' && active !== 'settings' && <button onClick={headerAction.onClick} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm hover:brightness-95"><headerAction.icon className="size-4" />{headerAction.label}</button>}</div>
        </div>
        {active === 'dashboard' ? <Dashboard stats={dashboardStats} summary={dashboardSummary} recentStudents={recentStudents} weeklyAttendance={weeklyAttendance} health={academyHealth} loading={dashboardLoading} error={dashboardError} academyName={currentAcademy?.name ?? 'your academy'} reminderTemplate={currentAcademy?.reminderTemplate ?? null} onViewAll={() => goToModule('students')} onQuickAction={goToModule} onRecordPayment={() => setPaymentModal('picker')} />
        : active === 'students' ? <StudentsModule students={studentsList} loading={studentsLoading} error={studentsError} canManage={studentsCanManage} searchSeed={studentsSearchSeed} onAdd={() => setShowAdd(true)} onView={(s) => setViewingStudentId(s.id)} onEdit={(s) => setEditingStudent(s)} onDeactivate={(s) => { setStudentActionError(''); setDeactivatingStudent(s) }} onDelete={(s) => { setStudentActionError(''); setDeletingStudent(s) }} />
        : active === 'fees' ? <FeesModule invoices={invoicesList} loading={invoicesLoading} error={invoicesError} filter={feesFilter} onFilterChange={setFeesFilter} onRecordPayment={() => setPaymentModal('picker')} onRecordPaymentForInvoice={(invoice) => setPaymentModal(invoice)} />
        : active === 'attendance' ? <AttendanceModule date={attendanceDate} onDateChange={setAttendanceDate} students={attendanceStudents} loading={attendanceLoading} error={attendanceError} onMark={handleMarkAttendance} markingId={markingId} />
        : active === 'classes' ? <ClassesModule classes={classesList} loading={classesLoading} error={classesError} canManage={classesCanManage} onAdd={() => setShowAddClass(true)} onView={handleViewClassStudents} onEdit={(c) => setEditingClass(c)} onDeactivate={(c) => { setClassActionError(''); setDeactivatingClass(c) }} onDelete={(c) => { setClassActionError(''); setDeletingClass(c) }} />
        : active === 'staff' ? <StaffModule refreshKey={dataVersion} onAdd={() => setShowAddStaff(true)} notify={notify} />
        : active === 'website' ? <WebsiteModule notify={notify} />
        : active === 'reports' ? <ReportsModule />
        : <SettingsModule notify={notify} onNavigate={setActive} onAcademyUpdated={(patch) => setCurrentAcademy((a) => a && { ...a, ...patch })} />}
      </main>
    </div>
    {showAdd && <StudentFormModal mode="add" onClose={() => setShowAdd(false)} onSaved={handleStudentSaved} />}
    {editingStudent && <StudentFormModal mode="edit" studentId={editingStudent.id} onClose={() => setEditingStudent(null)} onSaved={handleStudentSaved} />}
    {viewingStudentId && <StudentDetailModal studentId={viewingStudentId} onClose={() => setViewingStudentId(null)} />}
    {deactivatingStudent && (
      <ConfirmDialog
        title={deactivatingStudent.status === 'INACTIVE' ? t('confirm.activateStudentTitle') : t('confirm.deactivateStudentTitle')}
        description={deactivatingStudent.status === 'INACTIVE' ? t('confirm.activateStudentBody', { name: deactivatingStudent.name }) : t('confirm.deactivateStudentBody', { name: deactivatingStudent.name })}
        confirmLabel={studentActionLoading ? t('confirm.working') : deactivatingStudent.status === 'INACTIVE' ? t('action.activateStudent') : t('action.deactivateStudent')}
        cancelLabel={t('confirm.cancel')}
        tone={deactivatingStudent.status === 'INACTIVE' ? 'primary' : 'warning'}
        loading={studentActionLoading}
        error={studentActionError}
        onConfirm={handleConfirmDeactivateStudent}
        onClose={() => { if (!studentActionLoading) setDeactivatingStudent(null) }}
      />
    )}
    {deletingStudent && (
      <ConfirmDialog
        title={t('confirm.deleteStudentTitle')}
        description={t('confirm.deleteStudentBody', { name: deletingStudent.name })}
        confirmLabel={studentActionLoading ? t('confirm.working') : t('action.deleteStudent')}
        cancelLabel={t('confirm.cancel')}
        tone="danger"
        loading={studentActionLoading}
        error={studentActionError}
        onConfirm={handleConfirmDeleteStudent}
        onClose={() => { if (!studentActionLoading) setDeletingStudent(null) }}
      />
    )}
    {showAddClass && <ClassFormModal mode="add" onClose={() => setShowAddClass(false)} onSaved={handleClassSaved} />}
    {editingClass && <ClassFormModal mode="edit" cls={editingClass} onClose={() => setEditingClass(null)} onSaved={handleClassSaved} />}
    {deactivatingClass && (
      <ConfirmDialog
        title={deactivatingClass.isActive ? t('confirm.deactivateClassTitle') : t('confirm.activateClassTitle')}
        description={deactivatingClass.isActive ? t('confirm.deactivateClassBody', { name: `${deactivatingClass.name} - ${deactivatingClass.section}` }) : t('confirm.activateClassBody', { name: `${deactivatingClass.name} - ${deactivatingClass.section}` })}
        confirmLabel={classActionLoading ? t('confirm.working') : deactivatingClass.isActive ? t('action.deactivateClass') : t('action.activateClass')}
        cancelLabel={t('confirm.cancel')}
        tone={deactivatingClass.isActive ? 'warning' : 'primary'}
        loading={classActionLoading}
        error={classActionError}
        onConfirm={handleConfirmToggleClassActive}
        onClose={() => { if (!classActionLoading) setDeactivatingClass(null) }}
      />
    )}
    {deletingClass && (
      <ConfirmDialog
        title={t('confirm.deleteClassTitle')}
        description={t('confirm.deleteClassBody', { name: `${deletingClass.name} - ${deletingClass.section}` })}
        confirmLabel={classActionLoading ? t('confirm.working') : t('action.deleteClass')}
        cancelLabel={t('confirm.cancel')}
        tone="danger"
        loading={classActionLoading}
        error={classActionError}
        onConfirm={handleConfirmDeleteClass}
        onClose={() => { if (!classActionLoading) setDeletingClass(null) }}
      />
    )}
    {showAddStaff && <AddStaffModal onClose={() => setShowAddStaff(false)} onCreated={handleStaffAdded} />}
    {paymentModal !== 'closed' && <RecordPaymentModal invoice={typeof paymentModal === 'object' ? paymentModal : undefined} onClose={() => setPaymentModal('closed')} onRecorded={handlePaymentRecorded} />}
    {showDemo && <Modal title={t('demo.title')} onClose={() => setShowDemo(false)}><div className="flex flex-col gap-4 text-sm text-muted-foreground"><p><b className="text-foreground">{t('demo.point1Title')}</b> {t('demo.point1Body')}</p><p><b className="text-foreground">{t('demo.point2Title')}</b> {t('demo.point2Body')}</p><p><b className="text-foreground">{t('demo.point3Title')}</b> {t('demo.point3Body')}</p></div><button onClick={() => setShowDemo(false)} className="mt-6 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground">{t('demo.gotIt')}</button></Modal>}
    {showAccount && <Modal title={t('account.title')} onClose={() => setShowAccount(false)}><div className="space-y-4"><div className="flex items-center gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{currentUser ? initialsOf(currentUser.fullName).toUpperCase() : ''}</div><div className="min-w-0"><p className="truncate font-medium">{currentUser?.fullName}</p><p className="truncate text-sm text-muted-foreground">{currentUser?.email}</p></div></div><div className="rounded-xl border p-3 text-sm text-muted-foreground"><p><span className="font-medium text-foreground">{t('account.role')}:</span> {currentUser?.role}</p><p className="mt-1"><span className="font-medium text-foreground">{t('account.academy')}:</span> {currentAcademy?.name}</p></div><button onClick={handleSignOut} className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"><LogOut className="size-4" />{t('account.signOut')}</button></div></Modal>}
    {toast && <div role="status" className="fixed bottom-5 right-5 left-5 z-50 flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg sm:left-auto"><Check className="size-4 shrink-0 text-accent" /><span className="truncate">{toast}</span></div>}
  </div>
}

function LanguageToggle({ language, setLanguage }: { language: Language; setLanguage: (l: Language) => void }) {
  return <button onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')} className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-secondary sm:gap-2" aria-label="Toggle language"><Globe2 className="size-4 shrink-0" /><span className="hidden sm:inline">{language === 'en' ? 'English' : 'Roman Urdu'}</span></button>
}

const THEME_OPTIONS: { mode: ThemeMode; icon: any }[] = [
  { mode: 'light', icon: Sun },
  { mode: 'dark', icon: Moon },
  { mode: 'system', icon: Monitor },
]

function ThemeToggle({ theme, setTheme }: { theme: ThemeMode; setTheme: (t: ThemeMode) => void }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(() => setOpen(false))
  const ActiveIcon = THEME_OPTIONS.find((o) => o.mode === theme)?.icon ?? Monitor

  return <div className="relative" ref={ref}>
    <button onClick={() => setOpen((v) => !v)} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary" aria-label={t('theme.label')}><ActiveIcon className="size-4.5" /></button>
    {open && (
      <div className="absolute right-0 top-full z-40 mt-2 w-44 rounded-xl border bg-card p-1 shadow-lg">
        {THEME_OPTIONS.map(({ mode, icon: Icon }) => (
          <button key={mode} onClick={() => { setTheme(mode); setOpen(false) }} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${theme === mode ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
            <Icon className="size-4 shrink-0" />{t(`theme.${mode}`)}
          </button>
        ))}
      </div>
    )}
  </div>
}

function severityDot(severity: NotificationItem['severity']) {
  if (severity === 'high') return 'bg-rose-500'
  if (severity === 'medium') return 'bg-amber-500'
  if (severity === 'low') return 'bg-sky-500'
  return 'bg-emerald-500'
}

function notificationText(notif: NotificationItem, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (notif.type === 'overdueFees') return t('notifications.overdueFees', { n: notif.n ?? 0, s: notif.n === 1 ? '' : 's' })
  if (notif.type === 'pendingFees') return t('notifications.pendingFees', { n: notif.n ?? 0, s: notif.n === 1 ? '' : 's' })
  if (notif.type === 'trialEnding') return t('notifications.trialEnding', { n: notif.n ?? 0, s: notif.n === 1 ? '' : 's' })
  if (notif.type === 'attendanceMissing') return t('notifications.attendanceMissing')
  if (notif.type === 'newStudents') return t('notifications.newStudents', { n: notif.n ?? 0, s: notif.n === 1 ? '' : 's' })
  if (notif.type === 'planRequestPending') return t('notifications.planRequestPending', { plan: notif.label ?? '' })
  if (notif.type === 'planRequestApproved') return t('notifications.planRequestApproved', { plan: notif.label ?? '' })
  if (notif.type === 'planRequestRejected') return t('notifications.planRequestRejected', { plan: notif.label ?? '' })
  return ''
}

function NotificationsBell({ notifications, onSelect }: { notifications: NotificationItem[]; onSelect: (notif: NotificationItem) => void }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(() => setOpen(false))

  return <div className="relative" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button onClick={() => setOpen((v) => !v)} className="relative grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary" aria-label={t('notifications.title')}>
      <Bell className="size-5" />
      {notifications.length > 0 && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" />}
    </button>
    {open && (
      <div className="absolute right-0 top-full z-40 mt-2 w-[calc(100vw-1.5rem)] max-w-80 rounded-2xl border bg-card p-2 shadow-lg">
        <p className="px-3 py-2 text-sm font-semibold">{t('notifications.title')}</p>
        {notifications.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-muted-foreground">{t('notifications.empty')}</p>
        ) : (
          <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {notifications.map((notif) => (
              <button key={notif.id} onClick={() => { setOpen(false); onSelect(notif) }} className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-secondary">
                <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${severityDot(notif.severity)}`} />
                <p className="text-sm leading-5">{notificationText(notif, t)}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    )}
  </div>
}

function SignInScreen({ onSignedIn }: { onSignedIn: (user: CurrentUser, academy: CurrentAcademy) => void }) {
  const { t } = useLanguage()
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('signin.genericError'))
        return
      }
      onSignedIn(data.user, data.academy)
    } catch {
      setError(t('signin.serverError'))
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="grid min-h-screen place-items-center bg-background p-4">
    <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <Brand academyName={t('brand.signInTagline')} />
      <h1 className="mt-8 text-xl font-semibold">{showForgotPassword ? t('signin.resetTitle') : t('signin.welcomeBack')}</h1>
      {showForgotPassword ? (
        resetSent ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">{t('signin.resetSent')}</p>
            <button onClick={() => { setShowForgotPassword(false); setResetSent(false) }} className="w-full text-sm font-semibold text-primary">{t('signin.backToSignIn')}</button>
          </div>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); setResetSent(true) }} className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">{t('signin.resetIntro')}</p>
            <label className="block text-sm font-medium">{t('signin.email')}<input type="email" required className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="you@example.com" /></label>
            <button type="submit" className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground">{t('signin.sendResetLink')}</button>
            <button type="button" onClick={() => setShowForgotPassword(false)} className="w-full text-sm font-semibold text-primary">{t('signin.backToSignIn')}</button>
          </form>
        )
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <p className="rounded-xl bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-400">{error}</p>}
          <label className="block text-sm font-medium">{t('signin.email')}<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="owner@brightfuture.test" /></label>
          <label className="block text-sm font-medium">{t('signin.password')}<div className="relative mt-2"><input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border bg-background px-3 py-2.5 pr-11 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="Enter your password" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 px-3 text-muted-foreground hover:text-foreground" aria-label={showPassword ? t('signin.hidePassword') : t('signin.showPassword')}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label>
          <button type="button" onClick={() => setShowForgotPassword(true)} className="text-sm font-semibold text-primary">{t('signin.forgotPassword')}</button>
          <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60">{submitting && <Loader2 className="size-4 animate-spin" />}{t('signin.signIn')}</button>
        </form>
      )}
    </div>
  </div>
}

function Dashboard({ stats, summary, recentStudents, weeklyAttendance, health, loading, error, academyName, reminderTemplate, onViewAll, onQuickAction, onRecordPayment }: {
  stats: DashboardStats | null
  summary: DashboardSummary | null
  recentStudents: RecentStudent[]
  weeklyAttendance: WeeklyAttendanceDay[]
  health: AcademyHealth | null
  loading: boolean
  error: string
  academyName: string
  reminderTemplate: string | null
  onViewAll: () => void
  onQuickAction: (key: ActiveKey, opts?: { feesFilter?: FeesFilter }) => void
  onRecordPayment: () => void
}) {
  const { t } = useLanguage()
  if (error) {
    return <div className="rounded-2xl border bg-card p-10 text-center shadow-sm"><p className="text-sm text-rose-600 dark:text-rose-400">{error}</p></div>
  }
  if (loading || !stats) {
    return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl border bg-card shadow-sm" />)}</div>
  }

  const feesDetail = stats.feesChangePct === null
    ? t('stat.noComparisonYet')
    : stats.feesChangePct >= 0
      ? t('stat.changeUp', { pct: stats.feesChangePct.toFixed(1) })
      : t('stat.changeDown', { pct: Math.abs(stats.feesChangePct).toFixed(1) })
  const attendanceValue = stats.attendanceRateToday === null ? '—' : `${stats.attendanceRateToday.toFixed(1)}%`
  const attendanceDetail = stats.totalStudents === 0
    ? t('stat.noAttendanceToday')
    : t('attendance.counts', { p: stats.presentToday, a: stats.absentToday, l: stats.lateToday, e: stats.excusedToday, u: stats.attendanceNotMarkedToday })

  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat icon={Users} label={t('stat.totalStudents')} value={stats.totalStudents.toLocaleString()} detail={t('stat.addedThisMonth', { n: stats.studentsAddedThisMonth })} onClick={() => onQuickAction('students')} />
      <Stat icon={CircleDollarSign} label={t('stat.feesCollected')} value={currency(stats.feesThisMonth)} detail={feesDetail} tone="gold" onClick={() => onQuickAction('fees')} />
      <Stat icon={CalendarCheck2} label={t('stat.todaysAttendance')} value={attendanceValue} detail={attendanceDetail} onClick={() => onQuickAction('attendance')} />
      <Stat icon={Clock3} label={t('stat.pendingFees')} value={currency(stats.pendingAmount)} detail={t('stat.invoicesNeedAttention', { n: stats.pendingInvoiceCount })} tone="gold" onClick={() => onQuickAction('fees', { feesFilter: 'unpaid' })} />
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_1fr]">
      <div className="flex flex-col gap-4">
        <SummaryStrip summary={summary} onSelect={onQuickAction} />
        <RecentStudentsCard students={recentStudents} academyName={academyName} reminderTemplate={reminderTemplate} onViewAll={onViewAll} />
      </div>
      <section className="rounded-2xl border bg-primary p-6 text-primary-foreground shadow-sm">
        <div className="flex items-start justify-between"><div><p className="text-sm text-primary-foreground/70">{t('health.title')}</p><h2 className="mt-1 text-2xl font-semibold">{health && health.percent < 60 ? t('health.headingLow') : t('health.heading')}</h2></div><ShieldCheck className="size-6 text-accent" /></div>
        <p className="mt-8 text-sm leading-6 text-primary-foreground/75">{t('health.body')}</p>
        <div className="mt-6 flex items-center justify-between border-t border-primary-foreground/15 pt-4 text-sm"><span>{t('health.profileCompleteness')}</span><span className="font-semibold text-accent">{health ? `${health.percent}%` : '—'}</span></div>
        <div className="mt-2 h-2 rounded-full bg-primary-foreground/15"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${health?.percent ?? 0}%` }} /></div>
        {health && health.missing.length > 0 && (
          <p className="mt-2 text-xs leading-5 text-primary-foreground/60">{t('health.missingIntro', { items: health.missing.map((key) => t(`health.missing.${key}`)).join(', ') })}</p>
        )}
        <WeeklyAttendanceChart days={weeklyAttendance} />
      </section>
    </div>
    <div className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between"><div><h2 className="font-semibold">{t('quick.title')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('quick.subtitle')}</p></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <button onClick={() => onQuickAction('attendance')} className="flex items-center gap-3 rounded-xl border p-4 text-left hover:border-primary"><CalendarCheck2 className="size-5 shrink-0 text-primary" /><span><b className="block text-sm">{t('quick.markAttendance')}</b><small className="text-muted-foreground">{t('quick.markAttendanceDesc')}</small></span></button>
        <button onClick={onRecordPayment} className="flex items-center gap-3 rounded-xl border p-4 text-left hover:border-primary"><Receipt className="size-5 shrink-0 text-primary" /><span><b className="block text-sm">{t('action.recordPayment')}</b><small className="text-muted-foreground">{t('quick.recordPaymentDesc')}</small></span></button>
        <button onClick={() => onQuickAction('classes')} className="flex items-center gap-3 rounded-xl border p-4 text-left hover:border-primary"><BookOpen className="size-5 shrink-0 text-primary" /><span><b className="block text-sm">{t('quick.viewClasses')}</b><small className="text-muted-foreground">{t('quick.viewClassesDesc')}</small></span></button>
      </div>
    </div>
  </>
}

const SHORT_WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SHORT_WEEKDAYS_UR = ['Itwar', 'Peer', 'Mangal', 'Budh', 'Jume', 'Jumma', 'Hafta']

function WeeklyAttendanceChart({ days }: { days: WeeklyAttendanceDay[] }) {
  const { t, language } = useLanguage()
  if (days.length === 0) return null
  const barMaxPx = 56
  const shortWeekdays = language === 'ur' ? SHORT_WEEKDAYS_UR : SHORT_WEEKDAYS_EN

  return <div className="mt-6 border-t border-primary-foreground/15 pt-4">
    <p className="text-sm text-primary-foreground/70">{t('health.weeklyAttendance')}</p>
    <div className="mt-3 flex items-end justify-between gap-1.5 sm:gap-2">
      {days.map((day) => {
        const [, , dayStr] = day.date.split('-')
        const weekday = shortWeekdays[new Date(`${day.date}T00:00:00`).getDay()]
        const barPx = day.pct === null ? 2 : Math.max(4, Math.round((day.pct / 100) * barMaxPx))
        return <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex items-end" style={{ height: barMaxPx }}>
            <div
              className={`w-4 rounded-t sm:w-5 ${day.pct === null ? 'bg-primary-foreground/15' : 'bg-accent'}`}
              style={{ height: barPx }}
              title={day.pct === null ? t('stat.noAttendanceToday') : `${day.pct}%`}
            />
          </div>
          <span className="text-[10px] text-primary-foreground/50">{weekday}</span>
          <span className="text-[10px] font-medium text-primary-foreground/70">{dayStr}</span>
        </div>
      })}
    </div>
  </div>
}

function enrolledAgo(iso: string, t: (key: string, vars?: Record<string, string | number>) => string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return t('recent.enrolledToday')
  if (days === 1) return t('recent.enrolledYesterday')
  if (days < 30) return t('recent.enrolledDaysAgo', { n: days })
  const months = Math.floor(days / 30)
  if (months < 12) return t('recent.enrolledMonthsAgo', { n: months, s: months === 1 ? '' : 's' })
  const years = Math.floor(months / 12)
  return t('recent.enrolledYearsAgo', { n: years, s: years === 1 ? '' : 's' })
}

function sectionAvatar(section: string) {
  const key = section.trim().toLowerCase()
  if (key === 'blue') return 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
  if (key === 'green') return 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
  if (key === 'red') return 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400'
  return 'bg-secondary text-secondary-foreground'
}

function sectionDot(section: string) {
  const key = section.trim().toLowerCase()
  if (key === 'blue') return 'bg-indigo-500'
  if (key === 'green') return 'bg-emerald-500'
  if (key === 'red') return 'bg-rose-500'
  return 'bg-muted-foreground'
}

function SummaryStrip({ summary, onSelect }: { summary: DashboardSummary | null; onSelect: (key: ActiveKey) => void }) {
  const { t } = useLanguage()
  if (!summary) return null
  const items: { label: string; value: string; key: ActiveKey }[] = [
    { label: t('summary.newThisWeek'), value: String(summary.newEnrollmentsThisWeek), key: 'students' },
    { label: t('summary.collectionRate'), value: summary.collectionRatePct === null ? t('summary.noBillingYet') : `${Math.round(summary.collectionRatePct)}%`, key: 'fees' },
    { label: t('summary.attendanceCoverage'), value: summary.attendanceCoveragePct === null ? '—' : `${summary.attendanceCoveragePct}%`, key: 'attendance' },
  ]
  return <div className="grid grid-cols-3 gap-2 rounded-2xl border bg-card p-4 shadow-sm sm:gap-3">
    {items.map((item) => (
      <button key={item.label} onClick={() => onSelect(item.key)} className="min-w-0 rounded-xl text-left transition hover:opacity-80">
        <p className="text-base font-semibold tracking-tight sm:text-lg">{item.value}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.label}</p>
      </button>
    ))}
  </div>
}

function RecentStudentsCard({ students: rows, academyName, reminderTemplate, onViewAll }: {
  students: RecentStudent[]
  academyName: string
  reminderTemplate: string | null
  onViewAll: () => void
}) {
  const { t } = useLanguage()
  const [filter, setFilter] = useState<'all' | 'overdue' | 'pending' | 'paid'>('all')
  const [grouped, setGrouped] = useState(false)
  const [reminderFor, setReminderFor] = useState<RecentStudent | null>(null)

  const counts = useMemo(() => ({
    all: rows.length,
    overdue: rows.filter((s) => s.feeStatus === 'OVERDUE').length,
    pending: rows.filter((s) => s.feeStatus === 'PENDING' || s.feeStatus === 'PARTIAL').length,
    paid: rows.filter((s) => s.feeStatus === 'PAID').length,
  }), [rows])

  const filtered = useMemo(() => {
    if (filter === 'all') return rows
    if (filter === 'overdue') return rows.filter((s) => s.feeStatus === 'OVERDUE')
    if (filter === 'paid') return rows.filter((s) => s.feeStatus === 'PAID')
    return rows.filter((s) => s.feeStatus === 'PENDING' || s.feeStatus === 'PARTIAL')
  }, [rows, filter])

  const groups = useMemo(() => {
    if (!grouped) return null
    const map = new Map<string, RecentStudent[]>()
    for (const student of filtered) {
      const list = map.get(student.className) ?? []
      list.push(student)
      map.set(student.className, list)
    }
    return [...map.entries()]
  }, [filtered, grouped])

  const tabs = [
    { key: 'all', label: t('recent.all'), count: counts.all },
    { key: 'overdue', label: t('recent.overdue'), count: counts.overdue },
    { key: 'pending', label: t('recent.pending'), count: counts.pending },
    { key: 'paid', label: t('recent.paid'), count: counts.paid },
  ] as const

  return <section className="rounded-2xl border bg-card shadow-sm">
    <div className="flex items-center justify-between border-b p-5">
      <div><h2 className="font-semibold">{t('recent.title')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('recent.subtitle')}</p></div>
      <button onClick={onViewAll} className="shrink-0 text-sm font-semibold text-primary">{t('recent.viewAll')}</button>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setFilter(tab.key)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${filter === tab.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
            {tab.label} <span className={filter === tab.key ? 'opacity-70' : 'opacity-60'}>{tab.count}</span>
          </button>
        ))}
      </div>
      <button onClick={() => setGrouped((value) => !value)} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${grouped ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
        <Layers className="size-3.5" />{t('recent.groupByClass')}
      </button>
    </div>
    {filtered.length === 0 ? (
      <p className="p-5 text-sm text-muted-foreground">{rows.length === 0 ? t('recent.noStudents') : t('recent.noMatches')}</p>
    ) : groups ? (
      <div className="divide-y">
        {groups.map(([className, list]) => (
          <div key={className}>
            <div className="flex items-center gap-2 bg-secondary/50 px-5 py-2">
              <span className={`size-2 rounded-full ${sectionDot(list[0].section)}`} />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{className}</span>
              <span className="text-xs text-muted-foreground">· {list.length}</span>
            </div>
            <div className="divide-y">{list.map((student) => <StudentRowItem key={student.id} student={student} academyName={academyName} reminderTemplate={reminderTemplate} onRemind={setReminderFor} />)}</div>
          </div>
        ))}
      </div>
    ) : (
      <div className="divide-y">{filtered.map((student) => <StudentRowItem key={student.id} student={student} academyName={academyName} reminderTemplate={reminderTemplate} onRemind={setReminderFor} />)}</div>
    )}
    {reminderFor && <ReminderModal student={reminderFor} academyName={academyName} reminderTemplate={reminderTemplate} onClose={() => setReminderFor(null)} />}
  </section>
}

function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('92')) return digits
  if (digits.startsWith('0')) return `92${digits.slice(1)}`
  return digits
}

function StudentRowItem({ student, academyName, reminderTemplate, onRemind }: { student: RecentStudent; academyName: string; reminderTemplate: string | null; onRemind: (student: RecentStudent) => void }) {
  const { t } = useLanguage()
  const unpaid = student.feeStatus !== 'PAID'
  const statusWord = student.feeStatus === 'OVERDUE' ? t('reminder.statusOverdue') : t('reminder.statusPending')
  const monthPart = student.feeMonth ? ` for ${student.feeMonth}` : ''
  const whatsappMessage = reminderTemplate
    ? renderTemplate(reminderTemplate, { parent_name: student.parentName, student_name: student.name, academy_name: academyName, amount: currency(student.balance), month: student.feeMonth ?? '', status: statusWord })
    : t('reminder.body', { parentName: student.parentName, academyName, studentName: student.name, amount: currency(student.balance), monthPart, status: statusWord })
  const whatsappHref = `https://wa.me/${whatsappNumber(student.parentPhone)}?text=${encodeURIComponent(whatsappMessage)}`
  return <div className="flex items-start gap-3 p-4">
    <div className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold ${sectionAvatar(student.section)}`}>{initialsOf(student.name).toUpperCase()}</div>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate text-sm font-medium">{student.name}</p>
        {unpaid ? (
          <button onClick={() => onRemind(student)} title={t('reminder.title')} className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium transition hover:brightness-95 ${student.feeStatus === 'OVERDUE' ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400' : 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400'}`}>
            {feeStatusLabel(student.feeStatus, t)} · {t('recent.remind')}
          </button>
        ) : <Badge tone="green">{t('recent.paid')}</Badge>}
      </div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{student.className} · {enrolledAgo(student.admissionDate, t)}</p>
    </div>
    <div className="flex shrink-0 gap-1">
      <a href={whatsappHref} target="_blank" rel="noopener noreferrer" title={t('recent.whatsappParent', { name: student.parentName })} aria-label={t('recent.whatsappParent', { name: student.parentName })} className="grid size-8 place-items-center rounded-lg text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"><MessageCircle className="size-4" /></a>
    </div>
  </div>
}

function ReminderModal({ student, academyName, reminderTemplate, onClose }: { student: RecentStudent; academyName: string; reminderTemplate: string | null; onClose: () => void }) {
  const { t } = useLanguage()
  const statusWord = student.feeStatus === 'OVERDUE' ? t('reminder.statusOverdue') : t('reminder.statusPending')
  const monthPart = student.feeMonth ? ` for ${student.feeMonth}` : ''
  const [message, setMessage] = useState(
    reminderTemplate
      ? renderTemplate(reminderTemplate, { parent_name: student.parentName, student_name: student.name, academy_name: academyName, amount: currency(student.balance), month: student.feeMonth ?? '', status: statusWord })
      : t('reminder.body', { parentName: student.parentName, academyName, studentName: student.name, amount: currency(student.balance), monthPart, status: statusWord }),
  )
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const messageRef = useRef<HTMLTextAreaElement>(null)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
      return
    } catch {
      // Clipboard API is blocked in some browsers/contexts — fall back to selecting the text.
    }
    messageRef.current?.select()
    setCopyState('failed')
  }

  return <Modal title={t('reminder.title')} onClose={onClose}>
    <div className="space-y-4">
      <div className="rounded-xl border p-3 text-sm">
        <p className="font-medium">{student.name} · {student.className}</p>
        <p className="mt-1 text-muted-foreground">{student.parentName} · {student.parentPhone}</p>
        <p className="mt-1 text-muted-foreground">{t('reminder.outstanding')}: <span className="font-medium text-foreground">{currency(student.balance)}</span>{student.feeMonth ? ` (${student.feeMonth})` : ''}</p>
      </div>
      <label className="block text-sm font-medium">{t('reminder.message')}
        <textarea ref={messageRef} value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="mt-2 w-full resize-none rounded-xl border bg-background px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-ring" />
      </label>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <a href={`https://wa.me/${whatsappNumber(student.parentPhone)}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><MessageCircle className="size-4" />{t('reminder.whatsapp')}</a>
        <a href={`sms:${student.parentPhone}?body=${encodeURIComponent(message)}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><MessageSquare className="size-4" />{t('reminder.sms')}</a>
        {student.parentEmail ? (
          <a href={`mailto:${student.parentEmail}?subject=${encodeURIComponent(`Fee reminder · ${student.name}`)}&body=${encodeURIComponent(message)}`} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"><Mail className="size-4" />{t('reminder.email')}</a>
        ) : (
          <span title={t('reminder.noEmailOnFile')} className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-muted-foreground opacity-60"><Mail className="size-4" />{t('reminder.email')}</span>
        )}
        <button onClick={handleCopy} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-secondary">{copyState === 'copied' ? <Check className="size-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="size-4" />}{copyState === 'copied' ? t('reminder.copied') : t('reminder.copy')}</button>
      </div>
      {copyState === 'failed' && <p className="text-xs text-amber-700 dark:text-amber-400">{t('reminder.copyFailed')}</p>}
      <p className="text-xs text-muted-foreground">{t('reminder.footer')}</p>
    </div>
  </Modal>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panelRef.current?.focus()
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])
  return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4">
    <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl outline-none">
      <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">{title}</h2><button onClick={onClose} aria-label="Close" className="shrink-0"><X className="size-5" /></button></div>
      <div className="mt-6 max-h-[70vh] overflow-y-auto">{children}</div>
    </div>
  </div>
}

type ActionTone = 'neutral' | 'primary' | 'warning' | 'danger' | 'success'

const ACTION_TONE_CLASS: Record<ActionTone, string> = {
  neutral: 'border text-muted-foreground hover:border-primary hover:text-foreground hover:bg-secondary',
  primary: 'border text-primary hover:border-primary hover:bg-indigo-50 dark:hover:bg-indigo-500/10',
  warning: 'border text-amber-700 dark:text-amber-400 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10',
  danger: 'border text-rose-600 dark:text-rose-400 hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10',
  success: 'border text-emerald-700 dark:text-emerald-400 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10',
}

function ActionButton({ icon: Icon, label, tone = 'neutral', onClick, disabled }: {
  icon: any
  label: string
  tone?: ActionTone
  onClick: () => void
  disabled?: boolean
}) {
  return <span className="group/tip relative inline-flex">
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`grid size-8 place-items-center rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 ${ACTION_TONE_CLASS[tone]}`}
    >
      <Icon className="size-4" />
    </button>
    <span role="tooltip" className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-[11px] font-medium text-background opacity-0 shadow-lg transition group-hover/tip:opacity-100 group-focus-within/tip:opacity-100">
      {label}
    </span>
  </span>
}

function ConfirmDialog({ title, description, confirmLabel, cancelLabel, tone = 'danger', loading, error, onConfirm, onClose }: {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  tone?: 'danger' | 'warning' | 'primary'
  loading: boolean
  error?: string
  onConfirm: () => void
  onClose: () => void
}) {
  const confirmClass = tone === 'danger'
    ? 'bg-rose-600 hover:bg-rose-700 text-white'
    : tone === 'warning'
      ? 'bg-amber-500 hover:bg-amber-600 text-white'
      : 'bg-primary hover:brightness-110 text-primary-foreground'
  return <Modal title={title} onClose={onClose}>
    <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    {error && <p className="mt-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-400">{error}</p>}
    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={onClose} disabled={loading} className="rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-60">{cancelLabel}</button>
      <button type="button" onClick={onConfirm} disabled={loading} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${confirmClass}`}>{loading && <Loader2 className="size-4 animate-spin" />}{confirmLabel}</button>
    </div>
  </Modal>
}

function dateInputValue(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 10)
}

type StudentPrefill = { fullName?: string; parentName?: string; parentPhone?: string; parentEmail?: string; classId?: string }

function StudentFormModal({ mode, studentId, prefill, onClose, onSaved }: {
  mode: 'add' | 'edit'
  studentId?: string
  prefill?: StudentPrefill
  onClose: () => void
  onSaved: (student: StudentRow, isNew: boolean) => void
}) {
  const { t } = useLanguage()
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [classesError, setClassesError] = useState('')

  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [studentLoading, setStudentLoading] = useState(mode === 'edit')
  const [studentLoadError, setStudentLoadError] = useState('')

  const [fullName, setFullName] = useState(prefill?.fullName ?? '')
  const [parentName, setParentName] = useState(prefill?.parentName ?? '')
  const [parentPhone, setParentPhone] = useState(prefill?.parentPhone ?? '')
  const [parentEmail, setParentEmail] = useState(prefill?.parentEmail ?? '')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [admissionDate, setAdmissionDate] = useState('')
  const [classId, setClassId] = useState(prefill?.classId ?? '')
  const [monthlyFee, setMonthlyFee] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [feeTouched, setFeeTouched] = useState(mode === 'edit')

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (mode !== 'edit' || !studentId) return
    let cancelled = false
    fetch(`/api/students/${studentId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load student.')
        return res.json()
      })
      .then((data: { student: StudentDetail }) => {
        if (cancelled) return
        const s = data.student
        setStudent(s)
        setFullName(s.name)
        setParentName(s.parentName)
        setParentPhone(s.parentPhone)
        setParentEmail(s.parentEmail ?? '')
        setDateOfBirth(dateInputValue(s.dateOfBirth))
        setAdmissionDate(dateInputValue(s.admissionDate))
        setClassId(s.classId)
        setMonthlyFee(String(s.monthlyFee))
        setStatus(s.status)
      })
      .catch(() => { if (!cancelled) setStudentLoadError(t('toast.couldNotReachServer')) })
      .finally(() => { if (!cancelled) setStudentLoading(false) })
    return () => { cancelled = true }
  }, [mode, studentId, t])

  useEffect(() => {
    if (mode === 'edit' && studentLoading) return
    let cancelled = false
    fetch('/api/classes?activeOnly=1')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load classes.')
        return res.json()
      })
      .then((data: { classes: ClassOption[] }) => {
        if (cancelled) return
        let options = data.classes
        if (student && !options.some((c) => c.id === student.classId)) {
          const [name, section] = student.className.split(' · ')
          options = [{ id: student.classId, name: name ?? student.className, section: section ?? '', monthlyFee: student.monthlyFee }, ...options]
        }
        setClasses(options)
        if (mode === 'add' && options.length > 0) {
          const preselected = prefill?.classId ? options.find((c) => c.id === prefill.classId) : null
          setClassId(preselected ? preselected.id : options[0].id)
          setMonthlyFee(String((preselected ?? options[0]).monthlyFee))
        }
      })
      .catch(() => { if (!cancelled) setClassesError(t('toast.couldNotReachServer')) })
      .finally(() => { if (!cancelled) setClassesLoading(false) })
    return () => { cancelled = true }
  }, [t, mode, studentLoading, student, prefill])

  function handleClassChange(newClassId: string) {
    setClassId(newClassId)
    if (!feeTouched) {
      const selected = classes.find((c) => c.id === newClassId)
      if (selected) setMonthlyFee(String(selected.monthlyFee))
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const body = mode === 'add'
        ? { fullName, parentName, parentPhone, parentEmail, dateOfBirth, classId, monthlyFee: Number(monthlyFee) }
        : { fullName, parentName, parentPhone, parentEmail, dateOfBirth, admissionDate, classId, monthlyFee: Number(monthlyFee), status }
      const res = await fetch(mode === 'add' ? '/api/students' : `/api/students/${studentId}`, {
        method: mode === 'add' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('signin.genericError'))
        return
      }
      onSaved(data.student, mode === 'add')
      onClose()
    } catch {
      setError(t('signin.serverError'))
    } finally {
      setSubmitting(false)
    }
  }

  return <Modal title={mode === 'add' ? t('modal.addStudent') : t('modal.editStudent')} onClose={onClose}>
    {mode === 'edit' && studentLoading ? <div className="grid place-items-center p-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div> : mode === 'edit' && studentLoadError ? (
      <p className="text-sm text-rose-600 dark:text-rose-400">{studentLoadError}</p>
    ) : classesLoading ? <div className="grid place-items-center p-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div> : classesError ? (
      <p className="text-sm text-rose-600 dark:text-rose-400">{classesError}</p>
    ) : classes.length === 0 ? (
      <p className="text-sm text-muted-foreground">{t('form.addClassFirst')}</p>
    ) : (
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-xl bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-400">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">{t('form.studentName')}<input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. Sara Ahmed" /></label>
          <label className="text-sm font-medium">{t('form.parentName')}<input required value={parentName} onChange={(e) => setParentName(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. Faisal Ahmed" /></label>
          <label className="text-sm font-medium">{t('form.parentPhone')}<input required value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="03XX XXXXXXX" /></label>
          <label className="text-sm font-medium">{t('form.parentEmailOptional')}<input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="parent@example.com" /></label>
          <label className="text-sm font-medium">{t('form.dateOfBirthOptional')}<input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
          {mode === 'edit' && <label className="text-sm font-medium">{t('form.admissionDate')}<input required type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>}
          <label className="text-sm font-medium">{t('form.class')}<select required value={classId} onChange={(e) => handleClassChange(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal">{classes.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.section}</option>)}</select></label>
          <label className="text-sm font-medium">{t('form.monthlyFee')}<input required type="number" min="1" step="1" value={monthlyFee} onChange={(e) => { setFeeTouched(true); setMonthlyFee(e.target.value) }} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="Rs 3,500" /></label>
          {mode === 'edit' && <label className="text-sm font-medium">{t('form.studentStatus')}<select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal"><option value="ACTIVE">{t('studentStatus.active')}</option><option value="INACTIVE">{t('studentStatus.inactive')}</option><option value="GRADUATED">{t('studentStatus.graduated')}</option></select></label>}
        </div>
        <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground disabled:opacity-60">{submitting && <Loader2 className="size-4 animate-spin" />}{mode === 'add' ? t('form.saveStudent') : t('form.saveChanges')}</button>
      </form>
    )}
  </Modal>
}

function StudentDetailModal({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { t } = useLanguage()
  const [detail, setDetail] = useState<StudentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/students/${studentId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load student.')
        return res.json()
      })
      .then((data: { student: StudentDetail }) => { if (!cancelled) setDetail(data.student) })
      .catch(() => { if (!cancelled) setError(t('toast.couldNotReachServer')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [studentId, t])

  return <Modal title={t('modal.viewStudent')} onClose={onClose}>
    {loading ? <div className="grid place-items-center p-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div> : error ? (
      <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
    ) : detail && (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-lg font-semibold">{detail.name}</p><p className="text-sm text-muted-foreground">{detail.className}</p></div>
          <Badge tone={studentStatusTone(detail.status)}>{studentStatusLabel(detail.status, t)}</Badge>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('form.parentName')}</dt><dd className="mt-1 text-sm font-medium">{detail.parentName}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('form.parentPhone')}</dt><dd className="mt-1 text-sm font-medium">{detail.parentPhone}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('form.parentEmailOptional')}</dt><dd className="mt-1 text-sm font-medium">{detail.parentEmail ?? '—'}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('form.dateOfBirthOptional')}</dt><dd className="mt-1 text-sm font-medium">{detail.dateOfBirth ? dateInputValue(detail.dateOfBirth) : '—'}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('form.admissionDate')}</dt><dd className="mt-1 text-sm font-medium">{dateInputValue(detail.admissionDate)}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('form.monthlyFee')}</dt><dd className="mt-1 text-sm font-medium">{currency(detail.monthlyFee)}</dd></div>
          {detail.feeStatus && <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('students.colStatus')}</dt><dd className="mt-1"><Badge tone={feeStatusTone(detail.feeStatus)}>{feeStatusLabel(detail.feeStatus, t)}</Badge></dd></div>}
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{t('stat.todaysAttendance')}</dt><dd className="mt-1 text-sm font-medium">{detail.attendanceRate === null || detail.attendanceRate === undefined ? '—' : `${detail.attendanceRate}%`}</dd></div>
        </dl>
      </div>
    )}
  </Modal>
}

function StudentsModule({ students: rows, loading, error, canManage, searchSeed, onAdd, onView, onEdit, onDeactivate, onDelete }: {
  students: StudentRow[]
  loading: boolean
  error: string
  canManage: boolean
  searchSeed?: string
  onAdd: () => void
  onView: (student: StudentRow) => void
  onEdit: (student: StudentRow) => void
  onDeactivate: (student: StudentRow) => void
  onDelete: (student: StudentRow) => void
}) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (searchSeed) setQuery(searchSeed)
  }, [searchSeed])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((s) => s.name.toLowerCase().includes(q) || s.className.toLowerCase().includes(q))
  }, [rows, query])

  const classCount = useMemo(() => new Set(rows.map((s) => s.className)).size, [rows])

  return <section className="rounded-2xl border bg-card shadow-sm">
    <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-xl font-semibold">{t('students.title')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('students.subtitle', { n: rows.length, s: rows.length === 1 ? '' : 's', c: classCount, cs: classCount === 1 ? '' : 'es' })}</p></div>
      <div className="flex gap-2">
        <div className="flex min-w-0 items-center gap-2 rounded-xl border px-3"><Search className="size-4 shrink-0 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="w-24 min-w-0 bg-transparent py-2 text-sm outline-none sm:w-36" placeholder={t('students.search')} /></div>
        <button onClick={onAdd} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground"><Plus className="size-4" />{t('students.add')}</button>
      </div>
    </div>
    {error ? <p className="p-5 text-sm text-rose-600 dark:text-rose-400">{error}</p> : loading ? (
      <div className="grid place-items-center p-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
    ) : filtered.length === 0 ? (
      <div className="grid place-items-center p-16 text-center"><Users className="size-10 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">{rows.length === 0 ? t('students.noStudentsYet') : t('students.noMatches')}</h3><p className="mt-2 max-w-sm text-sm text-muted-foreground">{rows.length === 0 ? t('students.addFirst') : t('students.tryDifferent')}</p></div>
    ) : (
      <>
      {/* Mobile: card list */}
      <div className="divide-y sm:hidden">{filtered.map((s) => (
        <div key={s.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{s.name}</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{s.className}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge tone={feeStatusTone(s.feeStatus)}>{feeStatusLabel(s.feeStatus, t)}</Badge>
              {s.status !== 'ACTIVE' && <Badge tone={studentStatusTone(s.status)}>{studentStatusLabel(s.status, t)}</Badge>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{s.parentPhone}</span>
            <span>{currency(s.monthlyFee)}</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <ActionButton icon={Eye} label={t('action.view')} onClick={() => onView(s)} />
            {canManage && <>
              <ActionButton icon={Pencil} label={t('action.edit')} tone="primary" onClick={() => onEdit(s)} />
              <ActionButton icon={s.status === 'INACTIVE' ? UserCheck : UserX} label={s.status === 'INACTIVE' ? t('action.activate') : t('action.deactivate')} tone={s.status === 'INACTIVE' ? 'success' : 'warning'} onClick={() => onDeactivate(s)} />
              <ActionButton icon={Trash2} label={t('action.delete')} tone="danger" onClick={() => onDelete(s)} />
            </>}
          </div>
        </div>
      ))}</div>
      {/* Tablet & up: table */}
      <div className="hidden overflow-x-auto sm:block"><table className="w-full text-left text-sm"><thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">{t('students.colName')}</th><th className="px-5 py-3 font-medium">{t('students.colClass')}</th><th className="px-5 py-3 font-medium">{t('students.colPhone')}</th><th className="px-5 py-3 font-medium">{t('students.colFee')}</th><th className="px-5 py-3 font-medium">{t('students.colStatus')}</th><th className="px-5 py-3 text-right font-medium">{t('students.colActions')}</th></tr></thead><tbody className="divide-y">{filtered.map((s) => (
        <tr key={s.id}>
          <td className="px-5 py-4 font-medium">{s.name}</td>
          <td className="px-5 py-4 text-muted-foreground">{s.className}</td>
          <td className="px-5 py-4 text-muted-foreground">{s.parentPhone}</td>
          <td className="px-5 py-4 text-muted-foreground">{currency(s.monthlyFee)}</td>
          <td className="px-5 py-4"><div className="flex flex-wrap gap-1.5"><Badge tone={feeStatusTone(s.feeStatus)}>{feeStatusLabel(s.feeStatus, t)}</Badge>{s.status !== 'ACTIVE' && <Badge tone={studentStatusTone(s.status)}>{studentStatusLabel(s.status, t)}</Badge>}</div></td>
          <td className="px-5 py-4">
            <div className="flex items-center justify-end gap-1.5">
              <ActionButton icon={Eye} label={t('action.view')} onClick={() => onView(s)} />
              {canManage && <>
                <ActionButton icon={Pencil} label={t('action.edit')} tone="primary" onClick={() => onEdit(s)} />
                <ActionButton icon={s.status === 'INACTIVE' ? UserCheck : UserX} label={s.status === 'INACTIVE' ? t('action.activate') : t('action.deactivate')} tone={s.status === 'INACTIVE' ? 'success' : 'warning'} onClick={() => onDeactivate(s)} />
                <ActionButton icon={Trash2} label={t('action.delete')} tone="danger" onClick={() => onDelete(s)} />
              </>}
            </div>
          </td>
        </tr>
      ))}</tbody></table></div>
      </>
    )}
  </section>
}

const PAYMENT_METHOD_OPTIONS = [
  { value: 'CASH', labelKey: 'method.cash' },
  { value: 'BANK_TRANSFER', labelKey: 'method.bankTransfer' },
  { value: 'CARD', labelKey: 'method.card' },
  { value: 'ONLINE', labelKey: 'method.online' },
] as const

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

type InvoicePreview = { exists: boolean; invoiceId: string | null; amountDue: number; amountPaid: number; balance: number; status: string }

function RecordPaymentModal({ invoice: fixedInvoice, onClose, onRecorded }: {
  invoice?: InvoiceRow
  onClose: () => void
  onRecorded: (payment: { id: string; receiptNumber: string; amount: number }, invoiceId: string) => void
}) {
  const { t, language } = useLanguage()
  // One idempotency key per modal instance — retries/network-blips reuse it so
  // the server never records the same payment twice; a genuinely new payment
  // opens a fresh modal (fresh key).
  // Lazy state initializer runs exactly once for the modal's lifetime — pure
  // from React's perspective (no ref reads or impure calls during render).
  const [idempotencyKey] = useState<string>(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  )
  const [students, setStudents] = useState<StudentRow[]>([])
  const [studentsLoading, setStudentsLoading] = useState(!fixedInvoice)
  const [studentsError, setStudentsError] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState(fixedInvoice?.studentId ?? '')
  const [month, setMonth] = useState(fixedInvoice?.month ?? currentMonthKey())

  const [preview, setPreview] = useState<InvoicePreview | null>(
    fixedInvoice
      ? { exists: true, invoiceId: fixedInvoice.id, amountDue: fixedInvoice.amountDue, amountPaid: fixedInvoice.amountPaid, balance: fixedInvoice.balance, status: fixedInvoice.status }
      : null,
  )
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  const [amount, setAmount] = useState(fixedInvoice ? String(fixedInvoice.balance) : '')
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ paymentId: string; receiptNumber: string; amount: number } | null>(null)

  useEffect(() => {
    if (fixedInvoice) return
    let cancelled = false
    fetch('/api/students')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load students.')
        return res.json()
      })
      .then((data: { students: StudentRow[] }) => {
        if (cancelled) return
        setStudents(data.students)
        if (data.students.length > 0) setSelectedStudentId(data.students[0].id)
      })
      .catch(() => { if (!cancelled) setStudentsError(t('toast.couldNotReachServer')) })
      .finally(() => { if (!cancelled) setStudentsLoading(false) })
    return () => { cancelled = true }
  }, [fixedInvoice, t])

  useEffect(() => {
    if (fixedInvoice || !selectedStudentId || !month) return
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError('')
    fetch(`/api/invoices/lookup?studentId=${selectedStudentId}&month=${month}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load invoice.')
        return res.json()
      })
      .then((data: InvoicePreview) => {
        if (cancelled) return
        setPreview(data)
        setAmount(String(data.balance))
      })
      .catch(() => { if (!cancelled) setPreviewError(t('toast.couldNotReachServer')) })
      .finally(() => { if (!cancelled) setPreviewLoading(false) })
    return () => { cancelled = true }
  }, [fixedInvoice, selectedStudentId, month, t])

  const selectedStudent = students.find((s) => s.id === selectedStudentId) ?? null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          fixedInvoice
            ? { invoiceId: fixedInvoice.id, amount: Number(amount), paymentMethod, idempotencyKey }
            : { studentId: selectedStudentId, month, amount: Number(amount), paymentMethod, idempotencyKey },
        ),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('signin.genericError'))
        return
      }
      setResult({ paymentId: data.payment.id, receiptNumber: data.payment.receiptNumber, amount: data.payment.amount })
      onRecorded(data.payment, data.invoice.id)
    } catch {
      setError(t('signin.serverError'))
    } finally {
      setSubmitting(false)
    }
  }

  const balanceZero = preview !== null && preview.balance <= 0

  return <Modal title={t('modal.recordPayment')} onClose={onClose}>
    {result ? (
      <div className="space-y-4 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"><Check className="size-6" /></div>
        <p className="text-sm text-muted-foreground">{t('form.paymentRecorded', { amount: currency(result.amount) })}<br />{t('form.receiptLabel', { num: result.receiptNumber })}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a href={`/api/receipts/${result.paymentId}`} target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"><FileText className="size-4" />{t('form.downloadReceipt')}</a>
          <button onClick={onClose} className="flex-1 rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-secondary">{t('form.done')}</button>
        </div>
      </div>
    ) : studentsLoading ? (
      <div className="grid place-items-center p-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
    ) : studentsError ? (
      <p className="text-sm text-rose-600 dark:text-rose-400">{studentsError}</p>
    ) : !fixedInvoice && students.length === 0 ? (
      <p className="text-sm text-muted-foreground">{t('form.noStudentsYet')}</p>
    ) : (
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-xl bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-400">{error}</p>}
        {fixedInvoice ? (
          <div className="rounded-xl border p-3 text-sm">
            <p className="font-medium">{fixedInvoice.studentName} · {fixedInvoice.className}</p>
            <p className="mt-1 text-muted-foreground">{monthLabel(fixedInvoice.month, language)} · {t('form.balance')}: <span className="font-medium text-foreground">{currency(fixedInvoice.balance)}</span></p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">{t('form.student')}
              <select required value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal">
                {students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.className}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">{t('form.feeMonth')}
              <input required type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" />
            </label>
          </div>
        )}
        {!fixedInvoice && (
          previewLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t('form.checking', { month: monthLabel(month, language) })}</div>
          ) : previewError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{previewError}</p>
          ) : preview ? (
            <div className="rounded-xl border p-3 text-sm">
              {preview.exists ? (
                <>
                  <p>{t('form.existingInvoiceFor', { month: monthLabel(month, language) })}: <Badge tone={feeStatusTone(preview.status)}>{feeStatusLabel(preview.status, t)}</Badge></p>
                  <p className="mt-1 text-muted-foreground">{t('form.due')} {currency(preview.amountDue)} · {t('form.paid')} {currency(preview.amountPaid)} · {t('form.balance')} <span className="font-medium text-foreground">{currency(preview.balance)}</span></p>
                </>
              ) : (
                <p className="text-muted-foreground">{t('form.noInvoiceYetFor', { month: monthLabel(month, language), amount: selectedStudent ? currency(selectedStudent.monthlyFee) : currency(preview.amountDue) })}</p>
              )}
            </div>
          ) : null
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">{t('form.amount')}
            <input required type="number" min="1" step="1" max={preview?.balance} value={amount} onChange={(e) => setAmount(e.target.value)} disabled={balanceZero} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" />
          </label>
          <label className="text-sm font-medium">{t('form.paymentMethod')}
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal">
              {PAYMENT_METHOD_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
            </select>
          </label>
        </div>
        {balanceZero && <p className="text-sm text-emerald-700 dark:text-emerald-400">{t('form.alreadyPaid')}</p>}
        <button type="submit" disabled={submitting || balanceZero || previewLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground disabled:opacity-60">{submitting && <Loader2 className="size-4 animate-spin" />}{t('action.recordPayment')}</button>
      </form>
    )}
  </Modal>
}

function ClassFormModal({ mode, cls, onClose, onSaved }: {
  mode: 'add' | 'edit'
  cls?: ClassRow
  onClose: () => void
  onSaved: (cls: ClassRow, isNew: boolean) => void
}) {
  const { t } = useLanguage()
  const [name, setName] = useState(cls?.name ?? '')
  const [section, setSection] = useState(cls?.section ?? '')
  const [monthlyFee, setMonthlyFee] = useState(cls ? String(cls.monthlyFee) : '')
  const [teacherId, setTeacherId] = useState(cls?.teacherId ?? '')
  const [teachers, setTeachers] = useState<StaffRow[]>([])
  const [publicVisible, setPublicVisible] = useState(cls?.publicVisible ?? false)
  const [publicDescription, setPublicDescription] = useState(cls?.publicDescription ?? '')
  const [publicSubjects, setPublicSubjects] = useState(cls?.publicSubjects ?? '')
  const [electiveSubjects, setElectiveSubjects] = useState(cls?.electiveSubjects ?? [])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function updateElective(i: number, field: 'name' | 'monthlyFee', value: string) {
    setElectiveSubjects((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: field === 'monthlyFee' ? Number(value) || 0 : value } : e)))
  }
  function addElective() {
    if (electiveSubjects.length >= 10) return
    setElectiveSubjects((prev) => [...prev, { name: '', monthlyFee: 0 }])
  }
  function removeElective(i: number) {
    setElectiveSubjects((prev) => prev.filter((_, idx) => idx !== i))
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/staff')
      .then((res) => (res.ok ? res.json() : { staff: [] }))
      .then((data: { staff: StaffRow[] }) => { if (!cancelled) setTeachers((data.staff ?? []).filter((s) => s.isActive)) })
      .catch(() => { if (!cancelled) setTeachers([]) })
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const body = mode === 'add'
        ? { name, section, monthlyFee: Number(monthlyFee), teacherId: teacherId || null }
        : { name, section, monthlyFee: Number(monthlyFee), teacherId: teacherId || null, publicVisible, publicDescription, publicSubjects, electiveSubjects }
      const res = await fetch(mode === 'add' ? '/api/classes' : `/api/classes/${cls!.id}`, {
        method: mode === 'add' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('signin.genericError'))
        return
      }
      onSaved(data.class, mode === 'add')
      onClose()
    } catch {
      setError(t('signin.serverError'))
    } finally {
      setSubmitting(false)
    }
  }

  return <Modal title={mode === 'add' ? t('modal.addClass') : t('modal.editClass')} onClose={onClose}>
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-xl bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-400">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">{t('form.className')}<input required value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. Grade 11" /></label>
        <label className="text-sm font-medium">{t('form.section')}<input required value={section} onChange={(e) => setSection(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. Blue" /></label>
        <label className="text-sm font-medium">{t('form.monthlyFee')}<input required type="number" min="1" step="1" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="Rs 15,000" /></label>
        <label className="text-sm font-medium">{t('form.classTeacher')}<select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal"><option value="">{t('classes.unassigned')}</option>{teachers.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}</select></label>
      </div>
      {mode === 'edit' && <div className="rounded-xl border p-3">
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={publicVisible} onChange={(e) => setPublicVisible(e.target.checked)} className="size-4" />Show on public website</label>
        <p className="mt-1 text-xs text-muted-foreground">When enabled, this class appears in the Academics section of your public site with the fee shown.</p>
        {publicVisible && <>
          <textarea value={publicDescription} onChange={(e) => setPublicDescription(e.target.value)} placeholder="Short public description (optional)" rows={2} maxLength={300} className="mt-3 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <input value={publicSubjects} onChange={(e) => setPublicSubjects(e.target.value)} placeholder="Subjects taught, comma-separated (e.g. Math, Science, English)" className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <div className="mt-3">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Optional subjects (extra fee)</span><button type="button" onClick={addElective} disabled={electiveSubjects.length >= 10} className="inline-flex items-center gap-1 text-xs font-semibold text-primary disabled:opacity-40"><Plus className="size-3" />Add</button></div>
            <div className="mt-2 space-y-2">
              {electiveSubjects.map((e, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={e.name} onChange={(ev) => updateElective(i, 'name', ev.target.value)} placeholder="Subject name" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                  <input type="number" min="0" value={e.monthlyFee} onChange={(ev) => updateElective(i, 'monthlyFee', ev.target.value)} placeholder="Fee" className="w-28 shrink-0 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                  <button type="button" onClick={() => removeElective(i)} aria-label="Remove optional subject" className="shrink-0 text-muted-foreground hover:text-rose-600"><X className="size-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </>}
      </div>}
      <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground disabled:opacity-60">{submitting && <Loader2 className="size-4 animate-spin" />}{mode === 'add' ? t('form.saveClass') : t('form.saveChanges')}</button>
    </form>
  </Modal>
}

const FEES_UNPAID_STATUSES = new Set(['PENDING', 'PARTIAL', 'OVERDUE'])

function FeesModule({ invoices: rows, loading, error, filter, onFilterChange, onRecordPayment, onRecordPaymentForInvoice }: {
  invoices: InvoiceRow[]
  loading: boolean
  error: string
  filter: FeesFilter
  onFilterChange: (filter: FeesFilter) => void
  onRecordPayment: () => void
  onRecordPaymentForInvoice: (invoice: InvoiceRow) => void
}) {
  const { t, language } = useLanguage()
  const [query, setQuery] = useState('')
  const statusFiltered = useMemo(
    () => (filter === 'unpaid' ? rows.filter((inv) => FEES_UNPAID_STATUSES.has(inv.status)) : rows),
    [rows, filter],
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return statusFiltered
    return statusFiltered.filter((inv) => inv.studentName.toLowerCase().includes(q) || inv.className.toLowerCase().includes(q))
  }, [statusFiltered, query])

  const outstanding = useMemo(() => rows.reduce((sum, inv) => sum + inv.balance, 0), [rows])

  return <section className="rounded-2xl border bg-card shadow-sm">
    <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-xl font-semibold">{t('fees.title')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('fees.subtitle', { n: rows.length, s: rows.length === 1 ? '' : 's', amount: currency(outstanding) })}</p></div>
      <div className="flex flex-wrap gap-2">
        <div className="flex shrink-0 gap-1 rounded-xl border p-1">
          <button onClick={() => onFilterChange('all')} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${filter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>{t('fees.filterAll')}</button>
          <button onClick={() => onFilterChange('unpaid')} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${filter === 'unpaid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>{t('fees.filterUnpaid')}</button>
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded-xl border px-3"><Search className="size-4 shrink-0 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="w-24 min-w-0 bg-transparent py-2 text-sm outline-none sm:w-36" placeholder={t('students.search')} /></div>
        <button onClick={onRecordPayment} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground"><Plus className="size-4" /><span className="hidden sm:inline">{t('fees.recordPayment')}</span></button>
      </div>
    </div>
    {error ? <p className="p-5 text-sm text-rose-600 dark:text-rose-400">{error}</p> : loading ? (
      <div className="grid place-items-center p-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
    ) : filtered.length === 0 ? (
      <div className="grid place-items-center p-16 text-center"><Receipt className="size-10 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">{rows.length === 0 ? t('fees.noInvoicesYet') : t('fees.noMatches')}</h3><p className="mt-2 max-w-sm text-sm text-muted-foreground">{rows.length === 0 ? t('fees.autoCreated') : t('students.tryDifferent')}</p></div>
    ) : (
      <>
      {/* Mobile: card list */}
      <div className="divide-y sm:hidden">{filtered.map((inv) => (
        <div key={inv.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="truncate font-medium">{inv.studentName}</p><p className="truncate text-xs text-muted-foreground">{inv.className} · {monthLabel(inv.month, language)}</p></div>
            <Badge tone={feeStatusTone(inv.status)}>{feeStatusLabel(inv.status, t)}</Badge>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div><p className="text-xs text-muted-foreground">{t('fees.colDue')}</p><p className="font-medium">{currency(inv.amountDue)}</p></div>
            <div><p className="text-xs text-muted-foreground">{t('fees.colPaid')}</p><p className="font-medium">{currency(inv.amountPaid)}</p></div>
            <div><p className="text-xs text-muted-foreground">{t('fees.colBalance')}</p><p className="font-medium">{inv.balance > 0 ? currency(inv.balance) : '—'}</p></div>
          </div>
          {(inv.balance > 0 || inv.lastPaymentId) && (
            <div className="mt-3 flex items-center gap-4">
              {inv.balance > 0 && <button onClick={() => onRecordPaymentForInvoice(inv)} className="text-sm font-semibold text-primary">{t('fees.recordPayment')}</button>}
              {inv.lastPaymentId && <a href={`/api/receipts/${inv.lastPaymentId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><FileText className="size-3.5" />{t('fees.receipt')}</a>}
            </div>
          )}
        </div>
      ))}</div>
      {/* Tablet & up: table */}
      <div className="hidden overflow-x-auto sm:block"><table className="w-full text-left text-sm"><thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">{t('fees.colStudent')}</th><th className="px-5 py-3 font-medium">{t('fees.colMonth')}</th><th className="px-5 py-3 font-medium">{t('fees.colDue')}</th><th className="px-5 py-3 font-medium">{t('fees.colPaid')}</th><th className="px-5 py-3 font-medium">{t('fees.colBalance')}</th><th className="px-5 py-3 font-medium">{t('fees.colStatus')}</th><th className="px-5 py-3 text-right font-medium">{t('fees.colAction')}</th></tr></thead><tbody className="divide-y">{filtered.map((inv) => (
        <tr key={inv.id}>
          <td className="px-5 py-4"><p className="font-medium">{inv.studentName}</p><p className="text-xs text-muted-foreground">{inv.className}</p></td>
          <td className="px-5 py-4 text-muted-foreground">{monthLabel(inv.month, language)}</td>
          <td className="px-5 py-4 text-muted-foreground">{currency(inv.amountDue)}</td>
          <td className="px-5 py-4 text-muted-foreground">{currency(inv.amountPaid)}</td>
          <td className="px-5 py-4 font-medium">{inv.balance > 0 ? currency(inv.balance) : '—'}</td>
          <td className="px-5 py-4"><Badge tone={feeStatusTone(inv.status)}>{feeStatusLabel(inv.status, t)}</Badge></td>
          <td className="px-5 py-4">
            <div className="flex items-center justify-end gap-3">
              {inv.balance > 0 && <button onClick={() => onRecordPaymentForInvoice(inv)} className="text-sm font-semibold text-primary">{t('fees.recordPayment')}</button>}
              {inv.lastPaymentId && <a href={`/api/receipts/${inv.lastPaymentId}`} target="_blank" rel="noopener noreferrer" title={`${t('fees.receipt')} ${inv.lastReceiptNumber}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><FileText className="size-3.5" />{t('fees.receipt')}</a>}
            </div>
          </td>
        </tr>
      ))}</tbody></table></div>
      </>
    )}
  </section>
}

function ClassesModule({ classes: rows, loading, error, canManage, onAdd, onView, onEdit, onDeactivate, onDelete }: {
  classes: ClassRow[]
  loading: boolean
  error: string
  canManage: boolean
  onAdd: () => void
  onView: (cls: ClassRow) => void
  onEdit: (cls: ClassRow) => void
  onDeactivate: (cls: ClassRow) => void
  onDelete: (cls: ClassRow) => void
}) {
  const { t } = useLanguage()
  const totalStudents = useMemo(() => rows.reduce((sum, c) => sum + c.studentCount, 0), [rows])

  return <section className="rounded-2xl border bg-card shadow-sm">
    <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-xl font-semibold">{t('classes.title')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('classes.subtitle', { n: rows.length, es: rows.length === 1 ? '' : 'es', t: totalStudents, ts: totalStudents === 1 ? '' : 's' })}</p></div>
      <button onClick={onAdd} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground"><Plus className="size-4" />{t('classes.addClass')}</button>
    </div>
    {error ? <p className="p-5 text-sm text-rose-600 dark:text-rose-400">{error}</p> : loading ? (
      <div className="grid place-items-center p-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
    ) : rows.length === 0 ? (
      <div className="grid place-items-center p-16 text-center"><BookOpen className="size-10 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">{t('classes.noClassesYet')}</h3><p className="mt-2 max-w-sm text-sm text-muted-foreground">{t('classes.addFirst')}</p></div>
    ) : (
      <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">{rows.map((cls) => (
        <div key={cls.id} className={`rounded-xl border p-4 ${!cls.isActive ? 'opacity-70' : ''}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2"><span className={`size-2.5 shrink-0 rounded-full ${sectionDot(cls.section)}`} /><p className="truncate font-semibold">{cls.name} · {cls.section}</p></div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              {!cls.isActive && <Badge tone="amber">{t('classStatus.inactive')}</Badge>}
              {cls.publicVisible && <Badge tone="green">On website</Badge>}
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t('classes.students', { n: cls.studentCount, s: cls.studentCount === 1 ? '' : 's' })}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{t('classes.teacher', { name: cls.teacherName ?? t('classes.unassigned') })}</p>
          <p className="mt-3 text-lg font-semibold tracking-tight">{currency(cls.monthlyFee)}<span className="text-xs font-normal text-muted-foreground"> {t('classes.perMonth')}</span></p>
          <div className="mt-4 flex items-center justify-end gap-1.5 border-t pt-3">
            <ActionButton icon={Eye} label={t('action.view')} onClick={() => onView(cls)} />
            {canManage && <>
              <ActionButton icon={Pencil} label={t('action.edit')} tone="primary" onClick={() => onEdit(cls)} />
              <ActionButton icon={cls.isActive ? UserX : UserCheck} label={cls.isActive ? t('action.deactivate') : t('action.activate')} tone={cls.isActive ? 'warning' : 'success'} onClick={() => onDeactivate(cls)} />
              <ActionButton icon={Trash2} label={t('action.delete')} tone="danger" onClick={() => onDelete(cls)} />
            </>}
          </div>
        </div>
      ))}</div>
    )}
  </section>
}

const ROLE_OPTIONS = ['ADMIN', 'TEACHER', 'ACCOUNTANT'] as const

function roleLabel(role: string, t: (key: string) => string) {
  if (role === 'OWNER') return t('staff.roleOwner')
  if (role === 'ADMIN') return t('staff.roleAdmin')
  if (role === 'TEACHER') return t('staff.roleTeacher')
  if (role === 'ACCOUNTANT') return t('staff.roleAccountant')
  return role
}

function StaffModule({ refreshKey, onAdd, notify }: { refreshKey: number; onAdd: () => void; notify: (message: string) => void }) {
  const { t } = useLanguage()
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [limit, setLimit] = useState(1)
  const [activeCount, setActiveCount] = useState(0)
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState<StaffRow | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetch('/api/staff')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load staff.')
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setStaff(data.staff)
        setLimit(data.limit)
        setActiveCount(data.activeCount)
        setCanManage(data.canManage)
      })
      .catch(() => { if (!cancelled) setError(t('toast.couldNotReachServer')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [refreshKey, t])

  async function handleToggle(member: StaffRow) {
    setTogglingId(member.id)
    try {
      const res = await fetch(`/api/staff/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !member.isActive }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        notify(data.error ?? t('toast.couldNotReachServer'))
        return
      }
      setStaff((prev) => prev.map((s) => (s.id === member.id ? data.staff : s)))
      setActiveCount((prev) => prev + (data.staff.isActive ? 1 : -1))
    } catch {
      notify(t('toast.couldNotReachServer'))
    } finally {
      setTogglingId(null)
    }
  }

  const atLimit = activeCount >= limit

  return <section className="rounded-2xl border bg-card shadow-sm">
    <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold">{t('staff.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('staff.usage', { count: activeCount, limit, s: limit === 1 ? '' : 's' })}</p>
      </div>
      {canManage && <button onClick={onAdd} disabled={atLimit} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-40"><Plus className="size-4" />{t('staff.add')}</button>}
    </div>
    {atLimit && <p className="border-b bg-amber-50 px-5 py-2.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">{t('staff.limitReached', { limit, s: limit === 1 ? '' : 's' })}</p>}
    {error ? <p className="p-5 text-sm text-rose-600 dark:text-rose-400">{error}</p> : loading ? (
      <div className="grid place-items-center p-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
    ) : staff.length === 0 ? (
      <div className="grid place-items-center p-16 text-center"><UserRoundCog className="size-10 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">{t('staff.noneYet')}</h3></div>
    ) : (
      <>
      {/* Mobile: card list */}
      <div className="divide-y sm:hidden">{staff.map((member) => (
        <div key={member.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="truncate font-medium">{member.fullName}</p><p className="truncate text-xs text-muted-foreground">{roleLabel(member.role, t)} · {member.email}</p></div>
            <div className="flex shrink-0 flex-col items-end gap-1"><Badge tone={member.isActive ? 'green' : 'neutral'}>{member.isActive ? t('staff.active') : t('staff.inactive')}</Badge>{member.showOnWebsite && <Badge tone="green">On website</Badge>}</div>
          </div>
          {canManage && <div className="mt-3 flex flex-wrap items-center gap-4">
            <button onClick={() => setEditingProfile(member)} className="text-sm font-semibold text-primary">Website profile</button>
            {member.role !== 'OWNER' && (
              <button onClick={() => handleToggle(member)} disabled={togglingId === member.id || (!member.isActive && atLimit)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary disabled:opacity-40">
                {togglingId === member.id && <Loader2 className="size-3.5 animate-spin" />}
                {member.isActive ? t('staff.deactivate') : t('staff.reactivate')}
              </button>
            )}
          </div>}
        </div>
      ))}</div>
      {/* Tablet & up: table */}
      <div className="hidden overflow-x-auto sm:block"><table className="w-full text-left text-sm"><thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">{t('staff.colName')}</th><th className="px-5 py-3 font-medium">{t('staff.colRole')}</th><th className="px-5 py-3 font-medium">{t('staff.colContact')}</th><th className="px-5 py-3 font-medium">{t('staff.colStatus')}</th>{canManage && <th className="px-5 py-3 text-right font-medium">{t('fees.colAction')}</th>}</tr></thead><tbody className="divide-y">{staff.map((member) => (
        <tr key={member.id}>
          <td className="px-5 py-4 font-medium">{member.fullName}</td>
          <td className="px-5 py-4 text-muted-foreground">{roleLabel(member.role, t)}</td>
          <td className="px-5 py-4 text-muted-foreground">{member.email}{member.phone ? ` · ${member.phone}` : ''}</td>
          <td className="px-5 py-4"><div className="flex flex-wrap gap-1.5"><Badge tone={member.isActive ? 'green' : 'neutral'}>{member.isActive ? t('staff.active') : t('staff.inactive')}</Badge>{member.showOnWebsite && <Badge tone="green">On website</Badge>}</div></td>
          {canManage && <td className="px-5 py-4">
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setEditingProfile(member)} className="text-sm font-semibold text-primary">Website profile</button>
              {member.role !== 'OWNER' && (
                <button onClick={() => handleToggle(member)} disabled={togglingId === member.id || (!member.isActive && atLimit)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary disabled:opacity-40">
                  {togglingId === member.id && <Loader2 className="size-3.5 animate-spin" />}
                  {member.isActive ? t('staff.deactivate') : t('staff.reactivate')}
                </button>
              )}
            </div>
          </td>}
        </tr>
      ))}</tbody></table></div>
      </>
    )}
    {editingProfile && (
      <StaffPublicProfileModal
        member={editingProfile}
        onClose={() => setEditingProfile(null)}
        onSaved={(updated) => { setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s))); notify('Faculty profile updated successfully') }}
      />
    )}
  </section>
}

function StaffPublicProfileModal({ member, onClose, onSaved }: { member: StaffRow; onClose: () => void; onSaved: (member: StaffRow) => void }) {
  const [showOnWebsite, setShowOnWebsite] = useState(member.showOnWebsite ?? false)
  const [publicTitle, setPublicTitle] = useState(member.publicTitle ?? '')
  const [publicBio, setPublicBio] = useState(member.publicBio ?? '')
  const [publicPhotoUrl, setPublicPhotoUrl] = useState(member.publicPhotoUrl ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/staff/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showOnWebsite, publicTitle, publicBio, publicPhotoUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      onSaved(data.staff)
      onClose()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  return <Modal title="Public faculty profile" onClose={onClose}>
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-xl bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-400">{error}</p>}
      <p className="text-sm text-muted-foreground">Controls what appears on your public website's Faculty section for <span className="font-medium text-foreground">{member.fullName}</span>. Phone, email and other private details are never shown publicly.</p>
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={showOnWebsite} onChange={(e) => setShowOnWebsite(e.target.checked)} className="size-4" />Show on public website</label>
      {showOnWebsite && <div className="space-y-4">
        <label className="block text-sm font-medium">Title / position<input value={publicTitle} onChange={(e) => setPublicTitle(e.target.value)} placeholder="e.g. Senior English Teacher" className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
        <label className="block text-sm font-medium">Photo URL (optional)<input value={publicPhotoUrl} onChange={(e) => setPublicPhotoUrl(e.target.value)} placeholder="https://…" className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
        <label className="block text-sm font-medium">Short biography<textarea value={publicBio} onChange={(e) => setPublicBio(e.target.value)} rows={3} maxLength={500} className="mt-2 w-full resize-none rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
      </div>}
      <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground disabled:opacity-60">{submitting && <Loader2 className="size-4 animate-spin" />}Save profile</button>
    </form>
  </Modal>
}

function AddStaffModal({ onClose, onCreated }: { onClose: () => void; onCreated: (member: StaffRow) => void }) {
  const { t } = useLanguage()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<string>('TEACHER')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, phone, role, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('signin.genericError'))
        return
      }
      onCreated(data.staff)
      onClose()
    } catch {
      setError(t('signin.serverError'))
    } finally {
      setSubmitting(false)
    }
  }

  return <Modal title={t('modal.addStaff')} onClose={onClose}>
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-xl bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-400">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">{t('form.staffName')}<input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. Sana Noor" /></label>
        <label className="text-sm font-medium">{t('form.staffEmail')}<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="staff@example.com" /></label>
        <label className="text-sm font-medium">{t('form.staffPhone')}<input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="03XX XXXXXXX" /></label>
        <label className="text-sm font-medium">{t('form.staffRole')}<select value={role} onChange={(e) => setRole(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal">{ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleLabel(r, t)}</option>)}</select></label>
        <label className="text-sm font-medium sm:col-span-2">{t('form.staffPassword')}<input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="••••••" /></label>
      </div>
      <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground disabled:opacity-60">{submitting && <Loader2 className="size-4 animate-spin" />}{t('form.saveStaff')}</button>
    </form>
  </Modal>
}

type SiteData = {
  tagline: string
  cards: { title: string; description: string }[]
  features: string[]
  heroTitle: string | null
  heroSubtitle: string | null
  heroImageUrl: string | null
  admissionsOpen: boolean
  primaryCtaLabel: string
  secondaryCtaLabel: string
  aboutBody: string | null
  missionText: string | null
  principalName: string | null
  principalMessage: string | null
  principalPhotoUrl: string | null
  testimonials: { name: string; text: string; className?: string; published: boolean }[]
  faqs: { question: string; answer: string }[]
  slug: string
  academyName: string
  isPremium: boolean
  planTier: string
}

type LeadStatusKey = 'NEW' | 'CONTACTED' | 'VISIT_SCHEDULED' | 'APPLICATION' | 'ACCEPTED' | 'ENROLLED' | 'LOST'
const LEAD_STATUSES: LeadStatusKey[] = ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'APPLICATION', 'ACCEPTED', 'ENROLLED', 'LOST']

type LeadRow = {
  id: string
  name: string
  phone: string
  email: string | null
  message: string | null
  studentName: string | null
  interestedClassId: string | null
  interestedClassName: string | null
  source: string
  status: LeadStatusKey
  notes: string | null
  nextFollowUpAt: string | null
  assignedToUserId: string | null
  assignedToName: string | null
  convertedStudentId: string | null
  createdAt: string
  updatedAt: string
}

type SitePostRow = {
  id: string
  type: 'NEWS' | 'EVENT'
  title: string
  body: string | null
  imageUrl: string | null
  eventDate: string | null
  eventTime: string | null
  location: string | null
  published: boolean
  createdAt: string
}

function leadStatusTone(status: LeadStatusKey) {
  if (status === 'ENROLLED' || status === 'ACCEPTED') return 'green'
  if (status === 'LOST') return 'red'
  if (status === 'NEW') return 'neutral'
  return 'amber'
}
function leadStatusLabel(status: LeadStatusKey) {
  if (status === 'VISIT_SCHEDULED') return 'Visit scheduled'
  return status[0] + status.slice(1).toLowerCase()
}

const WEBSITE_TABS: { key: 'content' | 'news' | 'community' | 'leads'; label: string; icon: any }[] = [
  { key: 'content', label: 'Homepage', icon: Globe2 },
  { key: 'news', label: 'News & events', icon: Newspaper },
  { key: 'community', label: 'Testimonials & FAQ', icon: Quote },
  { key: 'leads', label: 'Admissions leads', icon: UserPlus },
]

function WebsiteModule({ notify }: { notify: (message: string) => void }) {
  const { t } = useLanguage()
  const [site, setSite] = useState<SiteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'content' | 'news' | 'community' | 'leads'>('content')

  useEffect(() => {
    let cancelled = false
    fetch('/api/site')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load site.')
        return res.json()
      })
      .then((data: SiteData) => { if (!cancelled) setSite(data) })
      .catch(() => { if (!cancelled) setError(t('toast.couldNotReachServer')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [t])

  if (loading) {
    return <div className="grid place-items-center rounded-2xl border bg-card p-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
  }
  if (error || !site) {
    return <div className="rounded-2xl border bg-card p-10 text-center shadow-sm"><p className="text-sm text-rose-600 dark:text-rose-400">{error}</p></div>
  }
  if (!site.isPremium) {
    return <section className="rounded-2xl border bg-card p-10 text-center shadow-sm">
      <LockKeyhole className="mx-auto size-10 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold">{t('website.lockedTitle')}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{t('website.lockedBody')}</p>
      <button onClick={() => notify(t('trial.upgradeRequested'))} className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">{t('trial.viewPlans')}</button>
    </section>
  }

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
      <div><h2 className="text-lg font-semibold">{site.academyName} — public website</h2><p className="mt-0.5 text-sm text-muted-foreground">Manage the content admission enquiries that appear on your live site.</p></div>
      <a href={`/site/${site.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"><Globe2 className="size-4" />{t('website.viewLiveSite')}</a>
    </div>

    <div className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1 shadow-sm">
      {WEBSITE_TABS.map((item) => (
        <button key={item.key} onClick={() => setTab(item.key)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${tab === item.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
          <item.icon className="size-4 shrink-0" />{item.label}
        </button>
      ))}
    </div>

    {tab === 'content' && <WebsiteContentTab site={site} notify={notify} />}
    {tab === 'news' && <WebsiteNewsTab notify={notify} />}
    {tab === 'community' && <WebsiteCommunityTab site={site} notify={notify} />}
    {tab === 'leads' && <WebsiteLeadsTab notify={notify} />}
  </div>
}

function WebsiteContentTab({ site, notify }: { site: SiteData; notify: (message: string) => void }) {
  const { t } = useLanguage()
  const [tagline, setTagline] = useState(site.tagline)
  const [cards, setCards] = useState(site.cards)
  const [features, setFeatures] = useState(site.features)
  const [savingContent, setSavingContent] = useState(false)

  const [heroTitle, setHeroTitle] = useState(site.heroTitle ?? '')
  const [heroSubtitle, setHeroSubtitle] = useState(site.heroSubtitle ?? '')
  const [heroImageUrl, setHeroImageUrl] = useState(site.heroImageUrl ?? '')
  const [admissionsOpen, setAdmissionsOpen] = useState(site.admissionsOpen)
  const [primaryCtaLabel, setPrimaryCtaLabel] = useState(site.primaryCtaLabel)
  const [secondaryCtaLabel, setSecondaryCtaLabel] = useState(site.secondaryCtaLabel)
  const [savingHero, setSavingHero] = useState(false)

  const [aboutBody, setAboutBody] = useState(site.aboutBody ?? '')
  const [missionText, setMissionText] = useState(site.missionText ?? '')
  const [principalName, setPrincipalName] = useState(site.principalName ?? '')
  const [principalMessage, setPrincipalMessage] = useState(site.principalMessage ?? '')
  const [principalPhotoUrl, setPrincipalPhotoUrl] = useState(site.principalPhotoUrl ?? '')
  const [savingAbout, setSavingAbout] = useState(false)

  async function saveSection(section: string, data: unknown, setSaving: (v: boolean) => void) {
    setSaving(true)
    try {
      const res = await fetch('/api/site', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, data }),
      })
      const resData = await res.json().catch(() => ({}))
      if (!res.ok) { notify(resData.error ?? t('toast.couldNotReachServer')); return }
      notify(t('website.saved'))
    } catch {
      notify(t('toast.couldNotReachServer'))
    } finally {
      setSaving(false)
    }
  }

  function updateCard(index: number, field: 'title' | 'description', value: string) {
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)))
  }
  function addCard() {
    if (cards.length >= 4) return
    setCards((prev) => [...prev, { title: '', description: '' }])
  }
  function removeCard(index: number) {
    setCards((prev) => prev.filter((_, i) => i !== index))
  }
  function updateFeature(index: number, value: string) {
    setFeatures((prev) => prev.map((f, i) => (i === index ? value : f)))
  }
  function addFeature() {
    if (features.length >= 12) return
    setFeatures((prev) => [...prev, ''])
  }
  function removeFeature(index: number) {
    setFeatures((prev) => prev.filter((_, i) => i !== index))
  }

  return <div className="space-y-5">
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <h3 className="font-semibold">Hero & admissions status</h3>
      <p className="mt-1 text-sm text-muted-foreground">The first thing a visiting parent sees.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Hero title<input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} placeholder={site.academyName} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
        <label className="text-sm font-medium">Admissions status
          <select value={admissionsOpen ? '1' : '0'} onChange={(e) => setAdmissionsOpen(e.target.value === '1')} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal">
            <option value="1">Admissions open</option>
            <option value="0">Admissions closed</option>
          </select>
        </label>
        <label className="text-sm font-medium sm:col-span-2">Hero subtitle<textarea value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} rows={2} maxLength={240} className="mt-2 w-full resize-none rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
        <label className="text-sm font-medium">Primary button label<input value={primaryCtaLabel} onChange={(e) => setPrimaryCtaLabel(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
        <label className="text-sm font-medium">Secondary button label<input value={secondaryCtaLabel} onChange={(e) => setSecondaryCtaLabel(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
        <label className="text-sm font-medium sm:col-span-2">Hero image URL (optional)<input value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} placeholder="https://…" className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /><span className="mt-1.5 block text-xs text-muted-foreground">A photo of your campus, students or classroom. Shown beside the hero text — a simple icon graphic is used if left blank.</span></label>
        {heroImageUrl.trim() && (
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-muted-foreground">Preview</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImageUrl} alt="" className="mt-2 h-28 w-44 rounded-xl border object-cover" onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} onLoad={(e) => { (e.target as HTMLImageElement).style.visibility = 'visible' }} />
          </div>
        )}
      </div>
      <button onClick={() => saveSection('hero', { heroTitle, heroSubtitle, heroImageUrl, admissionsOpen, primaryCtaLabel, secondaryCtaLabel }, setSavingHero)} disabled={savingHero} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60 sm:w-auto">{savingHero && <Loader2 className="size-4 animate-spin" />}Save hero</button>
    </section>

    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <h3 className="font-semibold">About, mission & principal's message</h3>
      <p className="mt-1 text-sm text-muted-foreground">Optional — sections only appear on the live site once filled in.</p>
      <div className="mt-4 grid gap-4">
        <label className="text-sm font-medium">About the academy<textarea value={aboutBody} onChange={(e) => setAboutBody(e.target.value)} rows={3} maxLength={800} className="mt-2 w-full resize-none rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
        <label className="text-sm font-medium">Mission<textarea value={missionText} onChange={(e) => setMissionText(e.target.value)} rows={2} maxLength={400} className="mt-2 w-full resize-none rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Principal's name<input value={principalName} onChange={(e) => setPrincipalName(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
          <label className="text-sm font-medium">Principal's photo URL (optional)<input value={principalPhotoUrl} onChange={(e) => setPrincipalPhotoUrl(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="https://…" /></label>
        </div>
        <label className="text-sm font-medium">Principal's message<textarea value={principalMessage} onChange={(e) => setPrincipalMessage(e.target.value)} rows={3} maxLength={600} className="mt-2 w-full resize-none rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
      </div>
      <button onClick={() => saveSection('about', { aboutBody, missionText, principalName, principalMessage, principalPhotoUrl }, setSavingAbout)} disabled={savingAbout} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60 sm:w-auto">{savingAbout && <Loader2 className="size-4 animate-spin" />}Save about section</button>
    </section>

    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <h3 className="font-semibold">Why families choose us & achievements</h3>
      <label className="mt-4 block text-sm font-medium">{t('website.tagline')}
        <textarea value={tagline} onChange={(e) => setTagline(e.target.value)} rows={2} maxLength={200} className="mt-2 w-full resize-none rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" />
      </label>

      <div className="mt-6">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{t('website.cards')}</h3><button onClick={addCard} disabled={cards.length >= 4} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary disabled:opacity-40"><Plus className="size-3.5" />{t('website.addCard')}</button></div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {cards.map((card, i) => (
            <div key={i} className="rounded-xl border p-3">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('website.cardN', { n: i + 1 })}</span><button onClick={() => removeCard(i)} aria-label={t('website.removeCard')} className="text-muted-foreground hover:text-rose-600"><X className="size-4" /></button></div>
              <input value={card.title} onChange={(e) => updateCard(i, 'title', e.target.value)} placeholder={t('website.cardTitle')} className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <textarea value={card.description} onChange={(e) => updateCard(i, 'description', e.target.value)} placeholder={t('website.cardDescription')} rows={2} className="mt-2 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          ))}
          {cards.length === 0 && <p className="text-sm text-muted-foreground">{t('website.noCards')}</p>}
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{t('website.features')}</h3><button onClick={addFeature} disabled={features.length >= 12} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary disabled:opacity-40"><Plus className="size-3.5" />{t('website.addFeature')}</button></div>
        <div className="mt-3 space-y-2">
          {features.map((feature, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={feature} onChange={(e) => updateFeature(i, e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <button onClick={() => removeFeature(i)} aria-label={t('website.removeFeature')} className="shrink-0 text-muted-foreground hover:text-rose-600"><X className="size-4" /></button>
            </div>
          ))}
          {features.length === 0 && <p className="text-sm text-muted-foreground">{t('website.noFeatures')}</p>}
        </div>
      </div>

      <button onClick={() => saveSection('content', { tagline, cards, features }, setSavingContent)} disabled={savingContent} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60 sm:w-auto">{savingContent && <Loader2 className="size-4 animate-spin" />}{t('website.save')}</button>
    </section>
  </div>
}

function WebsiteNewsTab({ notify }: { notify: (message: string) => void }) {
  const [posts, setPosts] = useState<SitePostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)
  const [editingPost, setEditingPost] = useState<SitePostRow | 'new' | null>(null)
  const [deletingPost, setDeletingPost] = useState<SitePostRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/site/posts')
      .then((res) => (res.ok ? res.json() : { posts: [], canManage: false }))
      .then((data) => { if (!cancelled) { setPosts(data.posts ?? []); setCanManage(Boolean(data.canManage)) } })
      .catch(() => { if (!cancelled) setPosts([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [dataVersion])

  async function handleDelete() {
    if (!deletingPost) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/site/posts/${deletingPost.id}`, { method: 'DELETE' })
      if (!res.ok) { notify('Could not delete this post.'); return }
      setDataVersion((v) => v + 1)
      notify('Post deleted successfully')
      setDeletingPost(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  return <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-semibold">News & events</h3><p className="mt-1 text-sm text-muted-foreground">Only published items appear on the live site.</p></div>
      {canManage && <button onClick={() => setEditingPost('new')} className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground"><Plus className="size-4" />Add post</button>}
    </div>
    {loading ? (
      <div className="grid place-items-center p-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
    ) : posts.length === 0 ? (
      <p className="mt-4 text-sm text-muted-foreground">No news or events yet.</p>
    ) : (
      <div className="mt-4 divide-y">
        {posts.map((post) => (
          <div key={post.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={post.type === 'EVENT' ? 'amber' : 'neutral'}>{post.type === 'EVENT' ? 'Event' : 'News'}</Badge>
                <Badge tone={post.published ? 'green' : 'neutral'}>{post.published ? 'Published' : 'Draft'}</Badge>
                <p className="truncate font-medium">{post.title}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{post.eventDate ? new Date(post.eventDate).toLocaleDateString() : new Date(post.createdAt).toLocaleDateString()}{post.eventTime ? ` · ${post.eventTime}` : ''}{post.location ? ` · ${post.location}` : ''}</p>
            </div>
            {canManage && <div className="flex shrink-0 items-center gap-1.5">
              <ActionButton icon={Pencil} label="Edit" tone="primary" onClick={() => setEditingPost(post)} />
              <ActionButton icon={Trash2} label="Delete" tone="danger" onClick={() => setDeletingPost(post)} />
            </div>}
          </div>
        ))}
      </div>
    )}
    {editingPost && (
      <SitePostFormModal
        post={editingPost === 'new' ? null : editingPost}
        onClose={() => setEditingPost(null)}
        onSaved={() => { setDataVersion((v) => v + 1); notify(editingPost === 'new' ? 'Post added successfully' : 'Post updated successfully') }}
      />
    )}
    {deletingPost && (
      <ConfirmDialog
        title="Delete this post?"
        description={`Are you sure you want to delete "${deletingPost.title}"? This action cannot be undone.`}
        confirmLabel={deleteLoading ? 'Working…' : 'Delete post'}
        cancelLabel="Cancel"
        tone="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onClose={() => { if (!deleteLoading) setDeletingPost(null) }}
      />
    )}
  </section>
}

function SitePostFormModal({ post, onClose, onSaved }: { post: SitePostRow | null; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<'NEWS' | 'EVENT'>(post?.type ?? 'NEWS')
  const [title, setTitle] = useState(post?.title ?? '')
  const [body, setBody] = useState(post?.body ?? '')
  const [imageUrl, setImageUrl] = useState(post?.imageUrl ?? '')
  const [eventDate, setEventDate] = useState(post?.eventDate ? dateInputValue(post.eventDate) : '')
  const [eventTime, setEventTime] = useState(post?.eventTime ?? '')
  const [location, setLocation] = useState(post?.location ?? '')
  const [published, setPublished] = useState(post?.published ?? false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const body_ = { type, title, body, imageUrl, eventDate: type === 'EVENT' ? eventDate : null, eventTime: type === 'EVENT' ? eventTime : null, location: type === 'EVENT' ? location : null, published }
      const res = await fetch(post ? `/api/site/posts/${post.id}` : '/api/site/posts', {
        method: post ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body_),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      onSaved()
      onClose()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  return <Modal title={post ? 'Edit post' : 'Add news or event'} onClose={onClose}>
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-xl bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-400">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Type
          <select value={type} onChange={(e) => setType(e.target.value as 'NEWS' | 'EVENT')} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal">
            <option value="NEWS">News</option>
            <option value="EVENT">Event</option>
          </select>
        </label>
        <label className="text-sm font-medium">Status
          <select value={published ? '1' : '0'} onChange={(e) => setPublished(e.target.value === '1')} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal">
            <option value="0">Draft</option>
            <option value="1">Published</option>
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium">Title<input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
      <label className="block text-sm font-medium">Description<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="mt-2 w-full resize-none rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
      <label className="block text-sm font-medium">Image URL (optional)<input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
      {type === 'EVENT' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium">Date<input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
          <label className="text-sm font-medium">Time (optional)<input value={eventTime} onChange={(e) => setEventTime(e.target.value)} placeholder="10:00 AM" className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
          <label className="text-sm font-medium">Location (optional)<input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
        </div>
      )}
      <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground disabled:opacity-60">{submitting && <Loader2 className="size-4 animate-spin" />}Save</button>
    </form>
  </Modal>
}

function WebsiteCommunityTab({ site, notify }: { site: SiteData; notify: (message: string) => void }) {
  const { t } = useLanguage()
  const [testimonials, setTestimonials] = useState(site.testimonials)
  const [savingTestimonials, setSavingTestimonials] = useState(false)
  const [faqs, setFaqs] = useState(site.faqs)
  const [savingFaqs, setSavingFaqs] = useState(false)

  async function saveSection(section: string, data: unknown, setSaving: (v: boolean) => void) {
    setSaving(true)
    try {
      const res = await fetch('/api/site', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ section, data }) })
      const resData = await res.json().catch(() => ({}))
      if (!res.ok) { notify(resData.error ?? t('toast.couldNotReachServer')); return }
      notify(t('website.saved'))
    } catch {
      notify(t('toast.couldNotReachServer'))
    } finally {
      setSaving(false)
    }
  }

  function updateTestimonial(i: number, field: 'name' | 'text' | 'className', value: string) {
    setTestimonials((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)))
  }
  function toggleTestimonialPublished(i: number) {
    setTestimonials((prev) => prev.map((item, idx) => (idx === i ? { ...item, published: !item.published } : item)))
  }
  function addTestimonial() {
    if (testimonials.length >= 12) return
    setTestimonials((prev) => [...prev, { name: '', text: '', className: '', published: false }])
  }
  function removeTestimonial(i: number) {
    setTestimonials((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateFaq(i: number, field: 'question' | 'answer', value: string) {
    setFaqs((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)))
  }
  function addFaq() {
    if (faqs.length >= 20) return
    setFaqs((prev) => [...prev, { question: '', answer: '' }])
  }
  function removeFaq(i: number) {
    setFaqs((prev) => prev.filter((_, idx) => idx !== i))
  }

  return <div className="space-y-5">
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between"><h3 className="font-semibold">Testimonials</h3><button onClick={addTestimonial} disabled={testimonials.length >= 12} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary disabled:opacity-40"><Plus className="size-3.5" />Add testimonial</button></div>
      <p className="mt-1 text-sm text-muted-foreground">Only published testimonials appear on the live site.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {testimonials.map((item, i) => (
          <div key={i} className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><input type="checkbox" checked={item.published} onChange={() => toggleTestimonialPublished(i)} className="size-3.5" />Published</label>
              <button onClick={() => removeTestimonial(i)} aria-label="Remove testimonial" className="text-muted-foreground hover:text-rose-600"><X className="size-4" /></button>
            </div>
            <input value={item.name} onChange={(e) => updateTestimonial(i, 'name', e.target.value)} placeholder="Parent name" className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input value={item.className ?? ''} onChange={(e) => updateTestimonial(i, 'className', e.target.value)} placeholder="Class (optional)" className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <textarea value={item.text} onChange={(e) => updateTestimonial(i, 'text', e.target.value)} placeholder="Testimonial" rows={2} className="mt-2 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
        ))}
        {testimonials.length === 0 && <p className="text-sm text-muted-foreground">No testimonials yet.</p>}
      </div>
      <button onClick={() => saveSection('testimonials', { testimonials }, setSavingTestimonials)} disabled={savingTestimonials} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60 sm:w-auto">{savingTestimonials && <Loader2 className="size-4 animate-spin" />}Save testimonials</button>
    </section>

    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between"><h3 className="font-semibold">Frequently asked questions</h3><button onClick={addFaq} disabled={faqs.length >= 20} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary disabled:opacity-40"><Plus className="size-3.5" />Add FAQ</button></div>
      <div className="mt-4 space-y-3">
        {faqs.map((faq, i) => (
          <div key={i} className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">FAQ {i + 1}</span>
              <button onClick={() => removeFaq(i)} aria-label="Remove FAQ" className="text-muted-foreground hover:text-rose-600"><X className="size-4" /></button>
            </div>
            <input value={faq.question} onChange={(e) => updateFaq(i, 'question', e.target.value)} placeholder="Question" className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <textarea value={faq.answer} onChange={(e) => updateFaq(i, 'answer', e.target.value)} placeholder="Answer" rows={2} className="mt-2 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
        ))}
        {faqs.length === 0 && <p className="text-sm text-muted-foreground">No FAQs yet.</p>}
      </div>
      <button onClick={() => saveSection('faqs', { faqs }, setSavingFaqs)} disabled={savingFaqs} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60 sm:w-auto">{savingFaqs && <Loader2 className="size-4 animate-spin" />}Save FAQs</button>
    </section>
  </div>
}

function WebsiteLeadsTab({ notify }: { notify: (message: string) => void }) {
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dataVersion, setDataVersion] = useState(0)
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatusKey>('all')
  const [selected, setSelected] = useState<LeadRow | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/site/inquiries')
      .then((res) => (res.ok ? res.json() : { leads: [] }))
      .then((data) => { if (!cancelled) setLeads(data.leads ?? []) })
      .catch(() => { if (!cancelled) setLeads([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [dataVersion])

  const filtered = statusFilter === 'all' ? leads : leads.filter((l) => l.status === statusFilter)

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 86_400_000)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const stats = [
    { label: 'New enquiries', value: leads.filter((l) => l.status === 'NEW').length },
    { label: 'Follow-ups today', value: leads.filter((l) => l.nextFollowUpAt && new Date(l.nextFollowUpAt) >= today && new Date(l.nextFollowUpAt) < tomorrow).length },
    { label: 'Visits scheduled', value: leads.filter((l) => l.status === 'VISIT_SCHEDULED').length },
    { label: 'Applications', value: leads.filter((l) => l.status === 'APPLICATION').length },
    { label: 'Enrolled this month', value: leads.filter((l) => l.status === 'ENROLLED' && new Date(l.updatedAt) >= monthStart).length },
  ]

  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-2xl font-semibold tracking-tight">{s.value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </div>

    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Admissions leads</h3>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="rounded-xl border bg-background px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{leadStatusLabel(s)}</option>)}
        </select>
      </div>
      {loading ? (
        <div className="grid place-items-center p-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No enquiries {statusFilter === 'all' ? 'yet' : 'with this status'}.</p>
      ) : (
        <div className="mt-4 divide-y">
          {filtered.map((lead) => (
            <button key={lead.id} onClick={() => setSelected(lead)} className="flex w-full items-start justify-between gap-3 py-3 text-left hover:bg-secondary/40">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{lead.name}</p><Badge tone={leadStatusTone(lead.status)}>{leadStatusLabel(lead.status)}</Badge></div>
                <p className="mt-0.5 text-sm text-muted-foreground">{lead.phone}{lead.email ? ` · ${lead.email}` : ''}{lead.interestedClassName ? ` · ${lead.interestedClassName}` : ''}</p>
                {lead.nextFollowUpAt && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Follow up {new Date(lead.nextFollowUpAt).toLocaleDateString()}{lead.assignedToName ? ` · ${lead.assignedToName}` : ''}</p>}
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">{new Date(lead.createdAt).toLocaleDateString()}</p>
            </button>
          ))}
        </div>
      )}
    </section>

    {selected && (
      <LeadDetailModal
        lead={selected}
        onClose={() => setSelected(null)}
        onUpdated={(updated) => { setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l))); setSelected(updated) }}
        notify={notify}
      />
    )}
  </div>
}

function LeadDetailModal({ lead, onClose, onUpdated, notify }: { lead: LeadRow; onClose: () => void; onUpdated: (lead: LeadRow) => void; notify: (message: string) => void }) {
  const [status, setStatus] = useState<LeadStatusKey>(lead.status)
  const [notes, setNotes] = useState(lead.notes ?? '')
  const [nextFollowUpAt, setNextFollowUpAt] = useState(lead.nextFollowUpAt ? dateInputValue(lead.nextFollowUpAt) : '')
  const [assignedToUserId, setAssignedToUserId] = useState(lead.assignedToUserId ?? '')
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [saving, setSaving] = useState(false)
  const [showConvert, setShowConvert] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/staff')
      .then((res) => (res.ok ? res.json() : { staff: [] }))
      .then((data: { staff: StaffRow[] }) => { if (!cancelled) setStaff((data.staff ?? []).filter((s) => s.isActive)) })
      .catch(() => { if (!cancelled) setStaff([]) })
    return () => { cancelled = true }
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/site/inquiries/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes, nextFollowUpAt: nextFollowUpAt || null, assignedToUserId: assignedToUserId || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { notify(data.error ?? 'Could not update this lead.'); return }
      onUpdated(data.lead)
      notify('Lead updated successfully')
    } catch {
      notify('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <Modal title={lead.name} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border p-3 text-sm">
          <p className="text-muted-foreground">{lead.phone}{lead.email ? ` · ${lead.email}` : ''}</p>
          {lead.studentName && <p className="mt-1">Child: <span className="font-medium">{lead.studentName}</span></p>}
          {lead.interestedClassName && <p className="mt-1 text-muted-foreground">Interested in {lead.interestedClassName}</p>}
          {lead.message && <p className="mt-2 leading-6">{lead.message}</p>}
          <p className="mt-2 text-xs text-muted-foreground">Source: {lead.source} · Received {new Date(lead.createdAt).toLocaleString()}</p>
        </div>

        {lead.convertedStudentId ? (
          <p className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">This lead has been converted to a student.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Status
              <select value={status} onChange={(e) => setStatus(e.target.value as LeadStatusKey)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal">
                {LEAD_STATUSES.map((s) => <option key={s} value={s}>{leadStatusLabel(s)}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Assigned to
              <select value={assignedToUserId} onChange={(e) => setAssignedToUserId(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal">
                <option value="">Unassigned</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium sm:col-span-2">Next follow-up date<input type="date" value={nextFollowUpAt} onChange={(e) => setNextFollowUpAt(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
            <label className="text-sm font-medium sm:col-span-2">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-2 w-full resize-none rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="e.g. Parent wants to visit campus." /></label>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {!lead.convertedStudentId && status === 'ACCEPTED' && (
            <button type="button" onClick={() => setShowConvert(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary px-4 py-2.5 text-sm font-semibold text-primary hover:bg-indigo-50 dark:hover:bg-indigo-500/10"><UserPlus className="size-4" />Convert to student</button>
          )}
          {!lead.convertedStudentId && (
            <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60">{saving && <Loader2 className="size-4 animate-spin" />}Save changes</button>
          )}
        </div>
      </div>
    </Modal>
    {showConvert && (
      <StudentFormModal
        mode="add"
        prefill={{ fullName: lead.studentName ?? '', parentName: lead.name, parentPhone: lead.phone, parentEmail: lead.email ?? '', classId: lead.interestedClassId ?? undefined }}
        onClose={() => setShowConvert(false)}
        onSaved={async (student) => {
          try {
            const res = await fetch(`/api/site/inquiries/${lead.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'ENROLLED', convertedStudentId: student.id }),
            })
            const data = await res.json().catch(() => ({}))
            if (res.ok) onUpdated(data.lead)
          } finally {
            notify('Student created and lead marked as enrolled')
            setShowConvert(false)
          }
        }}
      />
    )}
  </>
}

type ReportType = 'consolidated' | 'admissions' | 'fees' | 'attendance' | 'enquiries'
type ReportPeriodKey = 'week' | 'month' | 'year'
type ReportData = { periodLabel: string; summary: string[]; columns: string[]; rows: string[][] }

const REPORT_TYPES: ReportType[] = ['consolidated', 'admissions', 'fees', 'attendance', 'enquiries']
const REPORT_PERIODS: ReportPeriodKey[] = ['week', 'month', 'year']

function todayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function shiftDateKey(dateKey: string, period: ReportPeriodKey, direction: 1 | -1) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (period === 'week') date.setDate(date.getDate() + 7 * direction)
  else if (period === 'month') date.setMonth(date.getMonth() + direction)
  else date.setFullYear(date.getFullYear() + direction)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function ReportsModule() {
  const { t } = useLanguage()
  const [reportType, setReportType] = useState<ReportType>('consolidated')
  const [period, setPeriod] = useState<ReportPeriodKey>('month')
  const [dateKey, setDateKey] = useState(todayKey)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setLocked(false)
    fetch(`/api/reports?type=${reportType}&period=${period}&date=${dateKey}`)
      .then(async (res) => {
        if (res.status === 403) {
          if (!cancelled) setLocked(true)
          return null
        }
        if (!res.ok) throw new Error('Failed to load report.')
        return res.json()
      })
      .then((json) => { if (!cancelled && json) setData(json) })
      .catch(() => { if (!cancelled) setError(t('toast.couldNotReachServer')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [reportType, period, dateKey, t])

  const pdfHref = `/api/reports/pdf?type=${reportType}&period=${period}&date=${dateKey}`

  if (loading && !data && !locked) {
    return <div className="grid place-items-center rounded-2xl border bg-card p-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
  }

  if (locked) {
    return <section className="rounded-2xl border bg-card p-10 text-center shadow-sm">
      <LockKeyhole className="mx-auto size-10 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold">{t('reports.lockedTitle')}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{t('reports.lockedBody')}</p>
    </section>
  }

  return <section className="rounded-2xl border bg-card shadow-sm">
    <div className="border-b p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><h2 className="text-xl font-semibold">{t('reports.title')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('reports.subtitle')}</p></div>
        <a href={pdfHref} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm hover:brightness-95"><FileDown className="size-4" />{t('reports.downloadPdf')}</a>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {REPORT_TYPES.map((type) => (
          <button key={type} onClick={() => setReportType(type)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${reportType === type ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>{t(`reports.type.${type}`)}</button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border p-1">
          {REPORT_PERIODS.map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>{t(`reports.period.${p}`)}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setDateKey((d) => shiftDateKey(d, period, -1))} aria-label={t('reports.previous')} className="grid size-8 place-items-center rounded-lg border text-muted-foreground hover:bg-secondary"><ChevronLeft className="size-4" /></button>
          <input type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} className="rounded-xl border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <button onClick={() => setDateKey((d) => shiftDateKey(d, period, 1))} aria-label={t('reports.next')} className="grid size-8 place-items-center rounded-lg border text-muted-foreground hover:bg-secondary"><ChevronRight className="size-4" /></button>
        </div>
        {data && <span className="text-sm font-medium text-primary">{data.periodLabel}</span>}
      </div>
    </div>

    {error ? <p className="p-5 text-sm text-rose-600 dark:text-rose-400">{error}</p> : loading || !data ? (
      <div className="grid place-items-center p-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
    ) : (
      <div className="p-5">
        {data.summary.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.summary.map((line, i) => <li key={i} className="rounded-xl border bg-secondary/40 px-3 py-2 text-sm">{line}</li>)}
          </ul>
        )}
        {data.rows.length === 0 ? (
          <div className="grid place-items-center p-12 text-center"><BarChart3 className="size-10 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">{t('reports.noData')}</h3></div>
        ) : (
          <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground"><tr>{data.columns.map((col) => <th key={col} className="whitespace-nowrap px-4 py-3 font-medium">{col}</th>)}</tr></thead><tbody className="divide-y">{data.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="whitespace-nowrap px-4 py-3">{cell}</td>)}</tr>)}</tbody></table></div>
        )}
      </div>
    )}
  </section>
}

const ATTENDANCE_BUTTONS = [
  { key: 'PRESENT', label: 'P', activeClass: 'bg-emerald-500 text-white', titleKey: 'attendance.present' },
  { key: 'ABSENT', label: 'A', activeClass: 'bg-rose-500 text-white', titleKey: 'attendance.absent' },
  { key: 'LATE', label: 'L', activeClass: 'bg-amber-500 text-white', titleKey: 'attendance.late' },
  { key: 'EXCUSED', label: 'E', activeClass: 'bg-slate-500 text-white', titleKey: 'attendance.excused' },
] as const

function AttendanceModule({ date, onDateChange, students: rows, loading, error, onMark, markingId }: {
  date: string
  onDateChange: (date: string) => void
  students: AttendanceStudentRow[]
  loading: boolean
  error: string
  onMark: (studentId: string, classId: string, status: string) => void
  markingId: string | null
}) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((s) => s.name.toLowerCase().includes(q) || s.className.toLowerCase().includes(q))
  }, [rows, query])

  const counts = useMemo(() => ({
    present: rows.filter((s) => s.status === 'PRESENT').length,
    absent: rows.filter((s) => s.status === 'ABSENT').length,
    late: rows.filter((s) => s.status === 'LATE').length,
    excused: rows.filter((s) => s.status === 'EXCUSED').length,
    unmarked: rows.filter((s) => !s.status).length,
  }), [rows])

  return <section className="rounded-2xl border bg-card shadow-sm">
    <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-xl font-semibold">{t('attendance.title')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('attendance.counts', { p: counts.present, a: counts.absent, l: counts.late, e: counts.excused, u: counts.unmarked })}</p></div>
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-xl border bg-background px-3"><CalendarDays className="size-4 shrink-0 text-muted-foreground" /><input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} className="bg-transparent py-2 text-sm outline-none" /></div>
        <div className="flex min-w-0 items-center gap-2 rounded-xl border px-3"><Search className="size-4 shrink-0 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="w-24 min-w-0 bg-transparent py-2 text-sm outline-none sm:w-32" placeholder={t('students.search')} /></div>
      </div>
    </div>
    {error ? <p className="p-5 text-sm text-rose-600 dark:text-rose-400">{error}</p> : loading ? (
      <div className="grid place-items-center p-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
    ) : filtered.length === 0 ? (
      <div className="grid place-items-center p-16 text-center"><CalendarCheck2 className="size-10 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">{rows.length === 0 ? t('attendance.noStudentsYet') : t('attendance.noMatches')}</h3></div>
    ) : (
      <div className="divide-y">{filtered.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0"><p className="truncate text-sm font-medium">{s.name}</p><p className="truncate text-xs text-muted-foreground">{s.className}</p></div>
          <div className="flex shrink-0 gap-1.5">
            {ATTENDANCE_BUTTONS.map((btn) => (
              <button
                key={btn.key}
                onClick={() => onMark(s.id, s.classId, btn.key)}
                disabled={markingId === s.id}
                title={t(btn.titleKey)}
                className={`grid size-9 place-items-center rounded-lg text-xs font-semibold transition disabled:opacity-60 sm:size-8 ${s.status === btn.key ? btn.activeClass : 'border text-muted-foreground hover:bg-secondary'}`}
              >
                {markingId === s.id ? <Loader2 className="size-3.5 animate-spin" /> : btn.label}
              </button>
            ))}
          </div>
        </div>
      ))}</div>
    )}
  </section>
}

type SettingsProfile = { name: string; logoUrl: string | null; phone: string | null; whatsapp: string | null; address: string | null; openingHours: string | null; description: string | null; slug: string }
type SettingsReceipts = { receiptPrefix: string }
type SettingsTemplates = { reminderTemplate: string | null; reminderTemplateDefault: string }
type SettingsSubscription = { planTier: string; planLabel: string; trialEndsAt: string | null; hasReports: boolean; hasWebsite: boolean; staffLimit: number }
type SettingsData = { canManage: boolean; profile: SettingsProfile; receipts: SettingsReceipts; templates: SettingsTemplates; subscription: SettingsSubscription }
type SettingsSectionId = 'profile' | 'subscription' | 'receipts' | 'templates' | 'staff' | 'website' | 'security' | 'auditLog' | 'dataPrivacy'
type AuditLogEntry = { id: string; action: string; entityType: string; entityId: string; metadata: unknown; createdAt: string; userName: string; userEmail: string }

const SETTINGS_SECTIONS: { id: SettingsSectionId; group: string; icon: any; managedOnly?: boolean; keywords: string[] }[] = [
  { id: 'profile', group: 'general', icon: Building2, keywords: ['logo', 'name', 'address', 'phone'] },
  { id: 'receipts', group: 'finance', icon: Receipt, managedOnly: true, keywords: ['receipt', 'prefix', 'invoice', 'numbering'] },
  { id: 'templates', group: 'communication', icon: MessageSquare, managedOnly: true, keywords: ['whatsapp', 'sms', 'reminder', 'message', 'template'] },
  { id: 'staff', group: 'people', icon: UserRoundCog, managedOnly: true, keywords: ['staff', 'role', 'teacher', 'admin', 'accountant'] },
  { id: 'website', group: 'website', icon: Globe2, managedOnly: true, keywords: ['website', 'branding', 'cms', 'site'] },
  { id: 'subscription', group: 'account', icon: CreditCard, keywords: ['plan', 'tier', 'subscription', 'upgrade', 'billing'] },
  { id: 'security', group: 'system', icon: LockKeyhole, keywords: ['password', 'security'] },
  { id: 'auditLog', group: 'system', icon: History, managedOnly: true, keywords: ['audit', 'log', 'activity', 'history'] },
  { id: 'dataPrivacy', group: 'system', icon: Download, managedOnly: true, keywords: ['export', 'data', 'privacy', 'backup'] },
]
const SETTINGS_GROUP_ORDER = ['general', 'people', 'finance', 'communication', 'website', 'account', 'system']

function SettingsSectionHeader({ title, desc }: { title: string; desc: string }) {
  return <div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{desc}</p></div>
}

function SettingsModule({ notify, onNavigate, onAcademyUpdated }: { notify: (message: string) => void; onNavigate: (key: ActiveKey) => void; onAcademyUpdated: (patch: { name?: string; reminderTemplate?: string | null }) => void }) {
  const { t } = useLanguage()
  const [data, setData] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [section, setSection] = useState<SettingsSectionId>('profile')
  const [query, setQuery] = useState('')
  const [dirty, setDirty] = useState(false)
  const [pendingSection, setPendingSection] = useState<SettingsSectionId | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/settings')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load settings.')
        return res.json()
      })
      .then((json: SettingsData) => { if (!cancelled) setData(json) })
      .catch(() => { if (!cancelled) setError(t('toast.couldNotReachServer')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [t])

  function requestSectionChange(next: SettingsSectionId) {
    if (dirty && next !== section) { setPendingSection(next); return }
    setSection(next)
  }

  const visibleSections = useMemo(() => SETTINGS_SECTIONS.filter((s) => !s.managedOnly || data?.canManage), [data?.canManage])
  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return visibleSections
    return visibleSections.filter((s) => t(`settings.section.${s.id}`).toLowerCase().includes(q) || s.keywords.some((k) => k.includes(q)))
  }, [visibleSections, query, t])
  const groupedSections = useMemo(() => {
    const map = new Map<string, typeof visibleSections>()
    for (const s of filteredSections) {
      const list = map.get(s.group) ?? []
      list.push(s)
      map.set(s.group, list)
    }
    return SETTINGS_GROUP_ORDER.filter((g) => map.has(g)).map((g) => [g, map.get(g)!] as const)
  }, [filteredSections])

  if (loading) {
    return <div className="grid place-items-center rounded-2xl border bg-card p-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
  }
  if (error || !data) {
    return <div className="rounded-2xl border bg-card p-10 text-center shadow-sm"><p className="text-sm text-rose-600 dark:text-rose-400">{error}</p></div>
  }

  return <div>
    <div className="mb-4 flex items-center gap-2 rounded-xl border bg-card px-3 lg:max-w-xs">
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder={t('settings.search')} />
    </div>

    <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
      {filteredSections.map((s) => (
        <button key={s.id} onClick={() => requestSectionChange(s.id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${section === s.id ? 'bg-primary text-primary-foreground' : 'border text-muted-foreground hover:bg-secondary'}`}>
          <s.icon className="size-4" />{t(`settings.section.${s.id}`)}
        </button>
      ))}
      {filteredSections.length === 0 && <p className="px-1 py-2 text-sm text-muted-foreground">{t('settings.searchNoResults', { query })}</p>}
    </div>

    <div className="lg:grid lg:grid-cols-[220px_1fr] lg:items-start lg:gap-6">
      <aside className="hidden lg:block">
        {groupedSections.map(([group, items]) => (
          <div key={group} className="mb-5">
            <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`settings.group.${group}`)}</p>
            <div className="mt-1.5 flex flex-col gap-0.5">
              {items.map((s) => (
                <button key={s.id} onClick={() => requestSectionChange(s.id)} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${section === s.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                  <s.icon className="size-4 shrink-0" /><span className="truncate">{t(`settings.section.${s.id}`)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {groupedSections.length === 0 && <p className="px-3 text-sm text-muted-foreground">{t('settings.searchNoResults', { query })}</p>}
      </aside>

      <section className="min-w-0 rounded-2xl border bg-card shadow-sm">
        {section === 'profile' && <ProfileSection profile={data.profile} canManage={data.canManage} notify={notify} onDirtyChange={setDirty} onSaved={(profile) => { setData((d) => d && { ...d, profile }); onAcademyUpdated({ name: profile.name }) }} />}
        {section === 'receipts' && <ReceiptsSection receipts={data.receipts} notify={notify} onDirtyChange={setDirty} onSaved={(receipts) => setData((d) => d && { ...d, receipts })} />}
        {section === 'templates' && <TemplatesSection templates={data.templates} notify={notify} onDirtyChange={setDirty} onSaved={(templates) => { setData((d) => d && { ...d, templates }); onAcademyUpdated({ reminderTemplate: templates.reminderTemplate }) }} />}
        {section === 'staff' && <StaffSummarySection onNavigate={onNavigate} />}
        {section === 'website' && <WebsiteSummarySection hasWebsite={data.subscription.hasWebsite} slug={data.profile.slug} onNavigate={onNavigate} />}
        {section === 'subscription' && <SubscriptionSection subscription={data.subscription} canManage={data.canManage} notify={notify} />}
        {section === 'security' && <SecuritySection notify={notify} />}
        {section === 'auditLog' && <AuditLogSection />}
        {section === 'dataPrivacy' && <DataPrivacySection />}
      </section>
    </div>

    {pendingSection && (
      <Modal title={t('settings.unsavedTitle')} onClose={() => setPendingSection(null)}>
        <p className="text-sm text-muted-foreground">{t('settings.unsavedBody')}</p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => setPendingSection(null)} className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-secondary">{t('settings.keepEditing')}</button>
          <button onClick={() => { setSection(pendingSection); setPendingSection(null); setDirty(false) }} className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700">{t('settings.discard')}</button>
        </div>
      </Modal>
    )}
  </div>
}

function ProfileSection({ profile, canManage, notify, onDirtyChange, onSaved }: {
  profile: SettingsProfile
  canManage: boolean
  notify: (message: string) => void
  onDirtyChange: (dirty: boolean) => void
  onSaved: (profile: SettingsProfile) => void
}) {
  const { t } = useLanguage()
  const [name, setName] = useState(profile.name)
  const [logoUrl, setLogoUrl] = useState(profile.logoUrl ?? '')
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp ?? '')
  const [address, setAddress] = useState(profile.address ?? '')
  const [openingHours, setOpeningHours] = useState(profile.openingHours ?? '')
  const [description, setDescription] = useState(profile.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const dirty = name !== profile.name || logoUrl !== (profile.logoUrl ?? '') || phone !== (profile.phone ?? '') || whatsapp !== (profile.whatsapp ?? '') || address !== (profile.address ?? '') || openingHours !== (profile.openingHours ?? '') || description !== (profile.description ?? '')

  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  function handleCancel() {
    setName(profile.name)
    setLogoUrl(profile.logoUrl ?? '')
    setPhone(profile.phone ?? '')
    setWhatsapp(profile.whatsapp ?? '')
    setAddress(profile.address ?? '')
    setOpeningHours(profile.openingHours ?? '')
    setDescription(profile.description ?? '')
    setError('')
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    if (!canManage) return
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'profile', data: { name, logoUrl, phone, whatsapp, address, openingHours, description } }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? t('settings.saveError')); return }
      onSaved({ ...profile, ...json.profile })
      notify(t('settings.saved'))
    } catch {
      setError(t('settings.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return <form onSubmit={handleSave} className="p-5 sm:p-6">
    <SettingsSectionHeader title={t('settings.profile.title')} desc={t('settings.profile.desc')} />
    {!canManage && <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">{t('settings.viewOnlyNotice')}</p>}
    {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium sm:col-span-2">{t('settings.profile.name')}<input required disabled={!canManage} value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" /></label>
      <label className="text-sm font-medium sm:col-span-2">{t('settings.profile.logoUrl')}<input disabled={!canManage} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" /><span className="mt-1.5 block text-xs text-muted-foreground">{t('settings.profile.logoUrlHelp')}</span></label>
      {logoUrl.trim() && (
        <div className="sm:col-span-2">
          <p className="text-xs font-medium text-muted-foreground">{t('settings.profile.logoPreview')}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" className="mt-2 size-16 rounded-xl border object-cover" onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} onLoad={(e) => { (e.target as HTMLImageElement).style.visibility = 'visible' }} />
        </div>
      )}
      <label className="text-sm font-medium">{t('settings.profile.phone')}<input disabled={!canManage} value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" /></label>
      <label className="text-sm font-medium">WhatsApp number<input disabled={!canManage} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="03XX XXXXXXX" className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" /><span className="mt-1.5 block text-xs text-muted-foreground">Shown as a "Chat on WhatsApp" button on your public website.</span></label>
      <label className="text-sm font-medium">{t('settings.profile.address')}<input disabled={!canManage} value={address} onChange={(e) => setAddress(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" /></label>
      <label className="text-sm font-medium">Opening hours<input disabled={!canManage} value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} placeholder="Mon–Fri, 8am–3pm" className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" /></label>
      <label className="text-sm font-medium sm:col-span-2">{t('settings.profile.description')}<textarea disabled={!canManage} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-2 w-full resize-none rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" /><span className="mt-1.5 block text-xs text-muted-foreground">{t('settings.profile.descriptionHelp')}</span></label>
    </div>
    {canManage && (
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving || !dirty} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-50">{saving && <Loader2 className="size-4 animate-spin" />}{t('settings.save')}</button>
        {dirty && <button type="button" onClick={handleCancel} className="rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-secondary">{t('settings.cancel')}</button>}
        {dirty && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{t('settings.unsavedBadge')}</span>}
      </div>
    )}
  </form>
}

function ReceiptsSection({ receipts, notify, onDirtyChange, onSaved }: {
  receipts: SettingsReceipts
  notify: (message: string) => void
  onDirtyChange: (dirty: boolean) => void
  onSaved: (receipts: SettingsReceipts) => void
}) {
  const { t } = useLanguage()
  const [prefix, setPrefix] = useState(receipts.receiptPrefix)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dirty = prefix !== receipts.receiptPrefix

  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'receipts', data: { receiptPrefix: prefix } }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? t('settings.saveError')); return }
      onSaved(json.receipts)
      notify(t('settings.saved'))
    } catch {
      setError(t('settings.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return <form onSubmit={handleSave} className="p-5 sm:p-6">
    <SettingsSectionHeader title={t('settings.receipts.title')} desc={t('settings.receipts.desc')} />
    {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}
    <div className="mt-5 max-w-xs">
      <label className="text-sm font-medium">{t('settings.receipts.prefix')}
        <input required maxLength={10} value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-mono uppercase outline-none focus:ring-2 focus:ring-ring" />
      </label>
      <p className="mt-1.5 text-xs text-muted-foreground">{t('settings.receipts.prefixHelp')}</p>
      <p className="mt-3 rounded-xl bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">{t('settings.receipts.example')}: <span className="font-mono font-medium text-foreground">{prefix || 'RCP'}-K3F8X2-A1B2</span></p>
    </div>
    <div className="mt-6 flex items-center gap-3">
      <button type="submit" disabled={saving || !dirty} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-50">{saving && <Loader2 className="size-4 animate-spin" />}{t('settings.save')}</button>
      {dirty && <button type="button" onClick={() => setPrefix(receipts.receiptPrefix)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-secondary">{t('settings.cancel')}</button>}
    </div>
  </form>
}

function TemplatesSection({ templates, notify, onDirtyChange, onSaved }: {
  templates: SettingsTemplates
  notify: (message: string) => void
  onDirtyChange: (dirty: boolean) => void
  onSaved: (templates: SettingsTemplates) => void
}) {
  const { t } = useLanguage()
  const initial = templates.reminderTemplate ?? ''
  const [value, setValue] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dirty = value !== initial

  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  const effective = value.trim() || templates.reminderTemplateDefault
  const sample = renderTemplate(effective, {
    parent_name: 'Faisal Ahmed',
    student_name: 'Ayesha Khan',
    academy_name: 'Bright Future Academy',
    amount: 'Rs 15,000',
    month: 'September 2026',
    status: 'pending',
  })

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'templates', data: { reminderTemplate: value } }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? t('settings.saveError')); return }
      onSaved(json.templates)
      notify(t('settings.saved'))
    } catch {
      setError(t('settings.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return <form onSubmit={handleSave} className="p-5 sm:p-6">
    <SettingsSectionHeader title={t('settings.templates.title')} desc={t('settings.templates.desc')} />
    {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}
    <label className="mt-5 block text-sm font-medium">{t('settings.templates.label')}
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={5} placeholder={templates.reminderTemplateDefault} className="mt-2 w-full resize-none rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" />
    </label>
    <div className="mt-3">
      <p className="text-xs font-medium text-muted-foreground">{t('settings.templates.tokensLabel')}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {REMINDER_TEMPLATE_TOKENS.map((tok) => <code key={tok} className="rounded-md bg-secondary px-2 py-1 text-xs">{`{{${tok}}}`}</code>)}
      </div>
    </div>
    <div className="mt-4 rounded-xl border bg-secondary/40 p-3">
      <p className="text-xs font-medium text-muted-foreground">{t('settings.templates.previewLabel')}</p>
      <p className="mt-1.5 text-sm leading-6">{sample}</p>
    </div>
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button type="submit" disabled={saving || !dirty} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-50">{saving && <Loader2 className="size-4 animate-spin" />}{t('settings.save')}</button>
      {value !== '' && <button type="button" onClick={() => setValue('')} className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"><RotateCcw className="size-3.5" />{t('settings.templates.reset')}</button>}
    </div>
  </form>
}

function StaffSummarySection({ onNavigate }: { onNavigate: (key: ActiveKey) => void }) {
  const { t } = useLanguage()
  const [info, setInfo] = useState<{ activeCount: number; limit: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/staff')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelled && json) setInfo({ activeCount: json.activeCount, limit: json.limit }) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return <div className="p-5 sm:p-6">
    <SettingsSectionHeader title={t('settings.staff.title')} desc={t('settings.staff.desc')} />
    {info && <p className="mt-4 text-sm text-muted-foreground">{t('settings.staff.usage', { count: info.activeCount, limit: info.limit, s: info.limit === 1 ? '' : 's' })}</p>}
    <button onClick={() => onNavigate('staff')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm hover:brightness-95"><UserRoundCog className="size-4" />{t('settings.staff.manage')}</button>
  </div>
}

function WebsiteSummarySection({ hasWebsite, slug, onNavigate }: { hasWebsite: boolean; slug: string; onNavigate: (key: ActiveKey) => void }) {
  const { t } = useLanguage()
  return <div className="p-5 sm:p-6">
    <SettingsSectionHeader title={t('settings.website.title')} desc={t('settings.website.desc')} />
    {hasWebsite ? (
      <>
        <p className="mt-4 text-sm text-muted-foreground">{t('settings.website.live')} <a href={`/site/${slug}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">/site/{slug}</a></p>
        <button onClick={() => onNavigate('website')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm hover:brightness-95"><Globe2 className="size-4" />{t('settings.website.manage')}</button>
      </>
    ) : (
      <div className="mt-5 rounded-xl border p-6 text-center">
        <LockKeyhole className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">{t('settings.website.locked')}</p>
      </div>
    )}
  </div>
}

function SubscriptionFeatureRow({ label, included, t }: { label: string; included: boolean; t: (key: string) => string }) {
  return <div className="rounded-xl border p-4"><p className="text-sm font-medium">{label}</p><p className={`mt-1 text-sm font-semibold ${included ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{included ? t('settings.subscription.included') : t('settings.subscription.notIncluded')}</p></div>
}

type PlanRequestInfo = { id: string; currentTier: string; requestedTier: string; status: string; adminNote: string | null; createdAt: string; reviewedAt: string | null }

function SubscriptionSection({ subscription, canManage, notify }: { subscription: SettingsSubscription; canManage: boolean; notify: (message: string) => void }) {
  const { t } = useLanguage()
  const [request, setRequest] = useState<PlanRequestInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [pickingTier, setPickingTier] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    fetch('/api/settings/plan-request')
      .then((res) => (res.ok ? res.json() : { request: null }))
      .then((data) => setRequest(data.request ?? null))
      .catch(() => setRequest(null))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function handleConfirmRequest() {
    if (!pickingTier) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/settings/plan-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestedTier: pickingTier }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? t('settings.saveError')); return }
      notify(t('settings.subscription.requestSent'))
      setPickingTier(null)
      load()
    } catch {
      setError(t('settings.saveError'))
    } finally {
      setSubmitting(false)
    }
  }

  const higherTiers = (['TRIAL', 'BASIC', 'PRO'] as const).filter((tKey) => tierNumber(tKey) > tierNumber(subscription.planTier))
  const hasPending = request?.status === 'PENDING'

  return <div className="p-5 sm:p-6">
    <SettingsSectionHeader title={t('settings.subscription.title')} desc={t('settings.subscription.desc')} />
    <div className="mt-5 rounded-xl border bg-secondary/40 p-4">
      <p className="text-xs text-muted-foreground">{t('settings.subscription.currentPlan')}</p>
      <p className="mt-1 text-lg font-semibold">{subscription.planLabel}</p>
      {subscription.trialEndsAt && <p className="mt-1 text-xs text-muted-foreground">{t('settings.subscription.trialEnds', { date: new Date(subscription.trialEndsAt).toLocaleDateString('en-US') })}</p>}
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <SubscriptionFeatureRow label={t('settings.subscription.reports')} included={subscription.hasReports} t={t} />
      <SubscriptionFeatureRow label={t('settings.subscription.website')} included={subscription.hasWebsite} t={t} />
      <div className="rounded-xl border p-4"><p className="text-sm font-medium">{t('settings.subscription.staffAccounts')}</p><p className="mt-1 text-sm font-semibold">{subscription.staffLimit}</p></div>
    </div>

    {!loading && (
      <div className="mt-6">
        {hasPending && request ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <Loader2 className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-400">{t('settings.subscription.pending', { plan: planTierLabel(request.requestedTier), date: new Date(request.createdAt).toLocaleDateString() })}</p>
          </div>
        ) : (
          <>
            {request && request.status === 'REJECTED' && (
              <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
                {t('settings.subscription.lastRejected', { plan: planTierLabel(request.requestedTier) })}{request.adminNote ? ` — "${request.adminNote}"` : ''}
              </p>
            )}
            {higherTiers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('settings.subscription.alreadyTop')}</p>
            ) : canManage ? (
              <div>
                <p className="text-sm font-medium">{t('settings.subscription.upgradeTo')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {higherTiers.map((tKey) => (
                    <button key={tKey} onClick={() => setPickingTier(tKey)} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:border-primary hover:bg-indigo-50 dark:hover:bg-indigo-500/10">{t('settings.subscription.requestButton', { plan: tierBusinessName(tKey) })}</button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('settings.viewOnlyNotice')}</p>
            )}
          </>
        )}
      </div>
    )}

    {pickingTier && (
      <ConfirmDialog
        title={t('settings.subscription.confirmTitle', { plan: tierBusinessName(pickingTier) })}
        description={t('settings.subscription.confirmBody')}
        confirmLabel={submitting ? t('confirm.working') : t('settings.subscription.confirmSend')}
        cancelLabel={t('confirm.cancel')}
        tone="primary"
        loading={submitting}
        error={error}
        onConfirm={handleConfirmRequest}
        onClose={() => { if (!submitting) { setPickingTier(null); setError('') } }}
      />
    )}
  </div>
}

function SecuritySection({ notify }: { notify: (message: string) => void }) {
  const { t } = useLanguage()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) { setError(t('settings.security.mismatch')); return }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? t('settings.saveError')); return }
      notify(t('settings.security.saved'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setError(t('settings.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return <form onSubmit={handleSubmit} className="p-5 sm:p-6">
    <SettingsSectionHeader title={t('settings.security.title')} desc={t('settings.security.desc')} />
    {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}
    <div className="mt-5 grid gap-4 sm:max-w-sm">
      <label className="text-sm font-medium">{t('settings.security.currentPassword')}<input required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
      <label className="text-sm font-medium">{t('settings.security.newPassword')}<input required minLength={6} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
      <label className="text-sm font-medium">{t('settings.security.confirmPassword')}<input required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" /></label>
    </div>
    <button type="submit" disabled={saving} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60">{saving && <Loader2 className="size-4 animate-spin" />}{t('settings.security.save')}</button>
  </form>
}

function formatAuditAction(action: string) {
  return action.replace(/\./g, ' › ').replace(/_/g, ' ')
}

function AuditLogSection() {
  const { t } = useLanguage()
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/settings/audit-log')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load audit log.')
        return res.json()
      })
      .then((json) => { if (!cancelled) setEntries(json.entries) })
      .catch(() => { if (!cancelled) setError(t('toast.couldNotReachServer')) })
    return () => { cancelled = true }
  }, [t])

  return <div className="p-5 sm:p-6">
    <SettingsSectionHeader title={t('settings.auditLog.title')} desc={t('settings.auditLog.desc')} />
    {error ? <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p> : entries === null ? (
      <div className="mt-6 grid place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
    ) : entries.length === 0 ? (
      <p className="mt-4 text-sm text-muted-foreground">{t('settings.auditLog.empty')}</p>
    ) : (
      <div className="mt-4 divide-y">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium capitalize">{formatAuditAction(entry.action)}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('settings.auditLog.by', { name: entry.userName })}</p>
            </div>
            <p className="shrink-0 text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    )}
  </div>
}

function DataPrivacySection() {
  const { t } = useLanguage()
  return <div className="p-5 sm:p-6">
    <SettingsSectionHeader title={t('settings.dataPrivacy.title')} desc={t('settings.dataPrivacy.desc')} />
    <a href="/api/settings/export" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm hover:brightness-95"><Download className="size-4" />{t('settings.dataPrivacy.export')}</a>
  </div>
}

