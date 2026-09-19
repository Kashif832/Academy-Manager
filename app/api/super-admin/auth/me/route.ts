import { NextResponse } from 'next/server'
import { getSuperAdmin } from '@/lib/super-session'

export async function GET() {
  const superAdmin = await getSuperAdmin()
  if (!superAdmin) return NextResponse.json({ superAdmin: null })

  return NextResponse.json({
    superAdmin: { id: superAdmin.id, email: superAdmin.email, fullName: superAdmin.fullName },
  })
}
