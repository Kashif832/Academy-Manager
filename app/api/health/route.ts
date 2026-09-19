import { NextResponse } from 'next/server'

// Liveness probe: is the process up and serving? Deliberately does NOT touch
// the database — a liveness check must not fail because a dependency is slow,
// or an orchestrator will needlessly restart a healthy process.
export async function GET() {
  return NextResponse.json(
    { status: 'ok', uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
