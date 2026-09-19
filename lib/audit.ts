import { prisma } from '@/lib/prisma'
import { getActiveImpersonation } from '@/lib/super-session'

// Best-effort audit trail for administrative actions. Never throws — a logging
// failure must not block the action it's describing. Shared by tenant-scoped
// actions (userId) and platform-level Super Admin actions (superAdminId).
//
// Attribution safety: when a tenant-scoped action (userId set, no explicit
// superAdminId) is actually performed inside a live Super Admin impersonation
// session, the record is automatically enriched so it is NOT falsely attributed
// to the tenant owner alone — it also captures the real platform actor
// (superAdminId), the privileged session id, and an actorType of
// IMPERSONATED_SUPER_ADMIN. actorType and impersonationSessionId are written to
// first-class columns (and mirrored in metadata for backward compatibility).
export async function logAudit(opts: {
  academyId?: string
  userId?: string
  superAdminId?: string
  impersonationSessionId?: string
  action: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
}) {
  try {
    let superAdminId = opts.superAdminId
    let impersonationSessionId = opts.impersonationSessionId
    let actorType: string = opts.superAdminId ? 'SUPER_ADMIN' : opts.userId ? 'USER' : 'SYSTEM'
    let extraMeta: Record<string, unknown> = {}

    // Only auto-detect for tenant-scoped actions that did not already name a
    // Super Admin actor (direct Super Admin routes pass superAdminId explicitly).
    if (!opts.superAdminId && opts.userId) {
      try {
        const imp = await getActiveImpersonation()
        if (imp) {
          superAdminId = imp.superAdminId
          impersonationSessionId = impersonationSessionId ?? imp.sessionId
          actorType = 'IMPERSONATED_SUPER_ADMIN'
          extraMeta = {
            impersonatedBySuperAdminId: imp.superAdminId,
            impersonatedBySuperAdminName: imp.superAdminName,
            actingAsUserId: opts.userId,
          }
        }
      } catch {
        // Reading cookies can fail outside a request scope — non-fatal.
      }
    }

    await prisma.auditLog.create({
      data: {
        academyId: opts.academyId,
        userId: opts.userId,
        superAdminId,
        actorType,
        impersonationSessionId,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId,
        metadata: ({ actorType, ...extraMeta, ...(opts.metadata ?? {}) }) as object,
      },
    })
  } catch {
    // Non-fatal — auditing must never break the underlying operation.
  }
}
