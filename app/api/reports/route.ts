import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { isImpersonatingTenant } from '@/lib/super-session'
import { computeRange, getReport, type ReportPeriod, type ReportType } from '@/lib/reports'
import { hasReportsAccess } from '@/lib/tiers'

const VALID_TYPES = new Set<ReportType>(['admissions', 'fees', 'attendance', 'enquiries', 'consolidated'])
const VALID_PERIODS = new Set<ReportPeriod>(['week', 'month', 'year'])

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  // Platform access sits above tenant plan entitlements: a Super Admin
  // actively managing this tenant can always reach its reports.
  if (!hasReportsAccess(user.academy.planTier) && !(await isImpersonatingTenant(user.academyId))) {
    return NextResponse.json({ error: 'Upgrade to the Standard plan or above to access reports.' }, { status: 403 })
  }

  const type = request.nextUrl.searchParams.get('type') as ReportType
  const period = (request.nextUrl.searchParams.get('period') ?? 'month') as ReportPeriod
  const dateParam = request.nextUrl.searchParams.get('date')

  if (!VALID_TYPES.has(type)) return NextResponse.json({ error: 'Invalid report type.' }, { status: 400 })
  if (!VALID_PERIODS.has(period)) return NextResponse.json({ error: 'Invalid period.' }, { status: 400 })

  const { start, end, label } = computeRange(period, dateParam)
  const report = await getReport(type, user.academyId, start, end)

  return NextResponse.json({
    type,
    period,
    periodLabel: label,
    summary: report.summary,
    columns: report.columns,
    rows: report.rows,
  })
}
