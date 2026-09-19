import { prisma } from '@/lib/prisma'

export type ReportType = 'admissions' | 'fees' | 'attendance' | 'enquiries' | 'consolidated'
export type ReportPeriod = 'week' | 'month' | 'year'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseDateParam(dateStr: string | null): Date {
  if (dateStr) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  }
  return new Date()
}

export function computeRange(period: ReportPeriod, dateParam: string | null) {
  const anchor = parseDateParam(dateParam)
  anchor.setHours(0, 0, 0, 0)

  if (period === 'week') {
    const dayOfWeek = (anchor.getDay() + 6) % 7 // 0 = Monday
    const start = new Date(anchor.getTime() - dayOfWeek * 24 * 60 * 60 * 1000)
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
    const endInclusive = new Date(end.getTime() - 24 * 60 * 60 * 1000)
    const label = `${MONTH_NAMES[start.getMonth()].slice(0, 3)} ${start.getDate()} - ${MONTH_NAMES[endInclusive.getMonth()].slice(0, 3)} ${endInclusive.getDate()}, ${endInclusive.getFullYear()}`
    return { start, end, label }
  }

  if (period === 'year') {
    const start = new Date(anchor.getFullYear(), 0, 1)
    const end = new Date(anchor.getFullYear() + 1, 0, 1)
    return { start, end, label: String(anchor.getFullYear()) }
  }

  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)
  return { start, end, label: `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}` }
}

function money(n: number) {
  return `Rs ${Math.round(n).toLocaleString('en-US')}`
}

export async function getAdmissionsReport(academyId: string, start: Date, end: Date) {
  const students = await prisma.student.findMany({
    where: { academyId, admissionDate: { gte: start, lt: end } },
    orderBy: { admissionDate: 'asc' },
    include: { class: { select: { name: true, section: true } } },
  })

  const rows = students.map((s) => [
    s.fullName,
    `${s.class.name} · ${s.class.section}`,
    s.admissionDate.toLocaleDateString('en-US'),
    money(Number(s.monthlyFee)),
    s.status,
  ])

  return {
    summary: [`Total new admissions: ${students.length}`],
    columns: ['Student', 'Class', 'Admitted', 'Monthly fee', 'Status'],
    colWidths: [140, 110, 90, 90, 80],
    rows,
    tableData: students.map((s) => ({
      id: s.id,
      name: s.fullName,
      className: `${s.class.name} · ${s.class.section}`,
      admissionDate: s.admissionDate,
      monthlyFee: Number(s.monthlyFee),
      status: s.status,
    })),
  }
}

export async function getFeesReport(academyId: string, start: Date, end: Date) {
  const [payments, dueInvoices] = await Promise.all([
    prisma.feePayment.findMany({
      where: { academyId, paidAt: { gte: start, lt: end } },
      orderBy: { paidAt: 'asc' },
      include: { invoice: { include: { student: { select: { fullName: true } } } } },
    }),
    prisma.feeInvoice.findMany({
      where: { academyId, dueDate: { gte: start, lt: end } },
      select: { amountDue: true, amountPaid: true, status: true },
    }),
  ])

  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const outstanding = dueInvoices.reduce((sum, inv) => sum + (Number(inv.amountDue) - Number(inv.amountPaid)), 0)
  const byMethod = new Map<string, number>()
  for (const p of payments) byMethod.set(p.paymentMethod, (byMethod.get(p.paymentMethod) ?? 0) + Number(p.amount))

  const rows = payments.map((p) => [
    p.invoice.student.fullName,
    p.invoice.month,
    money(Number(p.amount)),
    p.paymentMethod,
    p.receiptNumber,
    p.paidAt.toLocaleDateString('en-US'),
  ])

  const summary = [
    `Total collected: ${money(totalCollected)} across ${payments.length} payment(s)`,
    `Outstanding on invoices due this period: ${money(outstanding)}`,
    ...[...byMethod.entries()].map(([method, amount]) => `${method}: ${money(amount)}`),
  ]

  return {
    summary,
    columns: ['Student', 'Month', 'Amount', 'Method', 'Receipt', 'Paid on'],
    colWidths: [110, 60, 80, 90, 110, 80],
    rows,
    tableData: payments.map((p) => ({
      id: p.id,
      student: p.invoice.student.fullName,
      month: p.invoice.month,
      amount: Number(p.amount),
      method: p.paymentMethod,
      receiptNumber: p.receiptNumber,
      paidAt: p.paidAt,
    })),
    totals: { totalCollected, outstanding, paymentCount: payments.length },
  }
}

export async function getAttendanceReport(academyId: string, start: Date, end: Date) {
  const records = await prisma.attendanceRecord.findMany({
    where: { academyId, date: { gte: start, lt: end } },
    include: { student: { select: { fullName: true } }, class: { select: { name: true, section: true } } },
    orderBy: { date: 'asc' },
  })

  const present = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length
  const absent = records.filter((r) => r.status === 'ABSENT').length
  const excused = records.filter((r) => r.status === 'EXCUSED').length
  const rate = records.length > 0 ? Math.round((present / records.length) * 100) : null

  const dayMap = new Map<string, { present: number; total: number }>()
  for (const r of records) {
    const key = localDateKey(r.date)
    const bucket = dayMap.get(key) ?? { present: 0, total: 0 }
    bucket.total += 1
    if (r.status === 'PRESENT' || r.status === 'LATE') bucket.present += 1
    dayMap.set(key, bucket)
  }

  const rows = [...dayMap.entries()].map(([date, { present: p, total }]) => [
    date,
    String(p),
    String(total - p),
    `${Math.round((p / total) * 100)}%`,
  ])

  return {
    summary: [
      `Overall attendance rate: ${rate === null ? 'N/A' : `${rate}%`}`,
      `Present/Late: ${present} · Absent: ${absent} · Excused: ${excused}`,
      `Total records: ${records.length}`,
    ],
    columns: ['Date', 'Present', 'Absent', 'Rate'],
    colWidths: [110, 90, 90, 70],
    rows,
    tableData: records.map((r) => ({
      id: r.id,
      student: r.student.fullName,
      className: `${r.class.name} · ${r.class.section}`,
      date: r.date,
      status: r.status,
    })),
    totals: { present, absent, excused, rate, total: records.length },
  }
}

export async function getEnquiriesReport(academyId: string, start: Date, end: Date) {
  const inquiries = await prisma.siteInquiry.findMany({
    where: { academyId, createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: 'asc' },
  })

  const rows = inquiries.map((i) => [
    i.name,
    i.phone,
    i.email ?? '—',
    i.createdAt.toLocaleDateString('en-US'),
    (i.message ?? '').slice(0, 40),
  ])

  return {
    summary: [`Total enquiries: ${inquiries.length}`],
    columns: ['Name', 'Phone', 'Email', 'Received', 'Message'],
    colWidths: [90, 90, 110, 80, 120],
    rows,
    tableData: inquiries.map((i) => ({
      id: i.id,
      name: i.name,
      phone: i.phone,
      email: i.email,
      message: i.message,
      createdAt: i.createdAt,
    })),
  }
}

export async function getConsolidatedReport(academyId: string, start: Date, end: Date) {
  const [admissions, fees, attendance, enquiries] = await Promise.all([
    getAdmissionsReport(academyId, start, end),
    getFeesReport(academyId, start, end),
    getAttendanceReport(academyId, start, end),
    getEnquiriesReport(academyId, start, end),
  ])

  const summary = [
    `New admissions: ${admissions.tableData.length}`,
    `Fees collected: ${money(fees.totals!.totalCollected)} (${fees.totals!.paymentCount} payments)`,
    `Outstanding fees due this period: ${money(fees.totals!.outstanding)}`,
    `Attendance rate: ${attendance.totals!.rate === null ? 'N/A' : `${attendance.totals!.rate}%`}`,
    `New enquiries: ${enquiries.tableData.length}`,
  ]

  const rows = [
    ['Admissions', String(admissions.tableData.length), '—'],
    ['Fees collected', money(fees.totals!.totalCollected), `${fees.totals!.paymentCount} payments`],
    ['Fees outstanding', money(fees.totals!.outstanding), 'due this period'],
    ['Attendance rate', attendance.totals!.rate === null ? 'N/A' : `${attendance.totals!.rate}%`, `${attendance.totals!.total} records`],
    ['Enquiries', String(enquiries.tableData.length), '—'],
  ]

  return {
    summary,
    columns: ['Metric', 'Value', 'Detail'],
    colWidths: [160, 140, 140],
    rows,
    sections: { admissions, fees, attendance, enquiries },
  }
}

export async function getReport(type: ReportType, academyId: string, start: Date, end: Date) {
  if (type === 'admissions') return getAdmissionsReport(academyId, start, end)
  if (type === 'fees') return getFeesReport(academyId, start, end)
  if (type === 'attendance') return getAttendanceReport(academyId, start, end)
  if (type === 'enquiries') return getEnquiriesReport(academyId, start, end)
  return getConsolidatedReport(academyId, start, end)
}
