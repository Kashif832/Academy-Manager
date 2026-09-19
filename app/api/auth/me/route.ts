import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { getImpersonationContext } from '@/lib/super-session'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ user: null, academy: null, impersonation: null })

  const ctx = await getImpersonationContext()
  const impersonation = ctx && ctx.tenantId === user.academyId
    ? { active: true, superAdminName: ctx.superAdminName, tenantName: ctx.tenantName }
    : null

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
    academy: {
      id: user.academy.id,
      name: user.academy.name,
      slug: user.academy.slug,
      planTier: user.academy.planTier,
      status: user.academy.status,
      trialEndsAt: user.academy.trialEndsAt,
      reminderTemplate: user.academy.reminderTemplate,
    },
    impersonation,
  })
}
