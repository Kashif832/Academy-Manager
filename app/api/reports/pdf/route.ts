import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { computeRange, getReport, localDateKey, type ReportPeriod, type ReportType } from '@/lib/reports'
import { generateReportPdf } from '@/lib/pdf'
import { hasReportsAccess } from '@/lib/tiers'

const VALID_TYPES = new Set<ReportType>(['admissions', 'fees', 'attendance', 'enquiries', 'consolidated'])
const VALID_PERIODS = new Set<ReportPeriod>(['week', 'month', 'year'])
const REPORT_TITLES: Record<ReportType, string> = {
  admissions: 'Admissions Report',
  fees: 'Fees Report',
  attendance: 'Attendance Report',
  enquiries: 'Enquiries Report',
  consolidated: 'Consolidated Report',
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  if (!hasReportsAccess(user.academy.planTier)) {
    return NextResponse.json({ error: 'Upgrade to the Standard plan or above to access reports.' }, { status: 403 })
  }

  const type = request.nextUrl.searchParams.get('type') as ReportType
  const period = (request.nextUrl.searchParams.get('period') ?? 'month') as ReportPeriod
  const dateParam = request.nextUrl.searchParams.get('date')

  if (!VALID_TYPES.has(type)) return NextResponse.json({ error: 'Invalid report type.' }, { status: 400 })
  if (!VALID_PERIODS.has(period)) return NextResponse.json({ error: 'Invalid period.' }, { status: 400 })

  const { start, end, label } = computeRange(period, dateParam)
  const report = await getReport(type, user.academyId, start, end)

  const pdf = generateReportPdf({
    academyName: user.academy.name,
    reportTitle: REPORT_TITLES[type],
    periodLabel: label,
    generatedAt: new Date(),
    summaryLines: report.summary,
    columns: report.columns,
    colWidths: report.colWidths,
    rows: report.rows,
  })

  const fileName = `${type}-report-${period}-${localDateKey(start)}.pdf`

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Content-Length': String(pdf.length),
    },
  })
}
