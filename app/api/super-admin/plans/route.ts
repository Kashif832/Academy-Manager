import { NextResponse } from 'next/server'
import { getSuperAdmin } from '@/lib/super-session'
import { tierCatalogue } from '@/lib/tiers'

export async function GET() {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  return NextResponse.json({ tiers: tierCatalogue() })
}
