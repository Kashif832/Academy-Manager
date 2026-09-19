import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

// Readiness probe: can the app actually serve traffic — i.e. is the database
// reachable? Returns 503 when a critical dependency is down so a load balancer
// stops routing traffic to this instance. Never leaks connection details.
export async function GET() {
  const started = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json(
      { status: 'ready', checks: { database: 'up' }, latencyMs: Date.now() - started },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    logger.error('readiness_db_check_failed', { err: err instanceof Error ? err.message : String(err) })
    return NextResponse.json(
      { status: 'unavailable', checks: { database: 'down' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
