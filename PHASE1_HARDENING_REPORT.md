# Phase 1 — Production Security & Correctness (Hardening Report)

**Target of this phase:** close the Phase 1 gaps from the independent review (impersonation architecture, route authorization, financial integrity, session/security hygiene) with **reproduced evidence**, not assertions.

All commands below were run in this environment. Anything that could not be verified here is marked explicitly.

---

## Clean-environment baseline (re-established)

The review noted prior "passing" claims could not be reproduced due to a Prisma permission/locking issue. **Reproduced and fixed:** the `EPERM` on `prisma generate` was a leftover `next dev` process holding the query-engine DLL. After stopping it and regenerating:

| Step | Result |
|---|---|
| `prisma generate` | ✅ `Generated Prisma Client (v6.19.3)` |
| `prisma validate` | ✅ valid |
| `prisma migrate status` | ✅ "Database schema is up to date!" |
| `tsc --noEmit` | ✅ exit 0 |
| `eslint .` | ✅ 0 errors (88 warnings) |
| `vitest run` | ✅ **40/40** |
| `next build` | ✅ compiled + **TypeScript gate now runs** + 36/36 pages |

> **Build correctness fix:** `next.config.mjs` previously had `typescript.ignoreBuildErrors: true`, so the build never failed on type errors. Removed — the build now runs `Running TypeScript … Finished TypeScript` as a real gate.

---

## 1.1 Super Admin Impersonation — redesigned (dedicated privileged session)

**Before:** the operator was signed into the tenant's OWNER account via the normal tenant cookie + a companion marker cookie.

**After (implemented & verified):** a dedicated, server-persisted `ImpersonationSession` row + an `impersonation_session` cookie that only references the row by id. `getSessionUser()` resolves the acting context from the row, so every existing tenant route works unchanged while the Super Admin actor + tenant are recorded explicitly.

Token payload: `{ typ, sid, superAdminId, superAdminName, tenantId, tenantName, actingUserId, actingRole, exp }` (HMAC-signed, distinct prefix).

**Live evidence:**
- Login → only `super_admin_session`. Impersonate → adds `impersonation_session`, **no `academy_session`** (no longer borrowing the owner login).
- Access to an INACTIVE tenant works **only** via impersonation (200); normal login for that tenant → 403.
- Cross-tenant isolation holds *while* impersonating (Riverside student → 404 while managing Dormant).
- **Clean exit** → 401 afterward; session row `endedAt` set.
- **Manual revocation** (`revokedAt`) → 401 mid-session.
- **Super Admin deactivation** → 401 on the next request (same cookies).
- **Expiry** (`expiresAt` in the past) → 401.
- **Audit attribution:** a tenant mutation performed while impersonating is stamped `actorType = IMPERSONATED_SUPER_ADMIN` with both the acting user *and* the real Super Admin + `impersonationSessionId` (first-class columns, not just metadata).

**Automated:** `tests/impersonation.test.ts` unit-tests the revocation/expiry/deactivation rules (6 tests).

**Schema (additive):** new `ImpersonationSession` model; `AuditLog.actorType` + `AuditLog.impersonationSessionId` columns. Migration `add_impersonation_session` applied non-destructively (dev data preserved).

---

## 1.2 Route-Level Authorization Audit

Every one of the **49** API routes was audited. Pattern findings:
- **Tenant routes** resolve identity via `getSessionUser()` and scope every query by `user.academyId` from the session (never client input).
- **Detail (`[id]`) routes** do a tenant-scoped `findFirst({ where: { id, academyId } })` existence check and return 404 before any update/delete — so cross-tenant IDs are indistinguishable from "not found".
- **Super-Admin routes** all gate on `getSuperAdmin()`.
- **Public routes** (`/api/public/site/*`) are intentionally unauthenticated and gated by tenant plan tier.

**Live boundary evidence:**

| Boundary | Test | Result |
|---|---|---|
| IDOR / cross-tenant read | A → B student `GET` | **404** |
| IDOR / cross-tenant write | A → B student `PATCH`/`DELETE` | **404**, B unchanged |
| Super-Admin-only | tenant session → `/api/super-admin/dashboard`,`/tenants` | **401** |
| Plan entitlement (write) | BASIC tenant → `PUT /api/site` | **403** |
| Plan entitlement (public) | non-premium tenant public site | **404** |
| Plan entitlement (allowed) | BASIC tenant → `GET /api/reports?type=fees` | **200** |
| Inactive **user** | deactivate mid-session → `GET /api/dashboard` | **401** |
| Inactive **tenant** | normal login blocked; impersonation-only access | **403 / 200** |
| RBAC (create) | TEACHER → students/classes/payments `POST` | **403** |

### Route authorization matrix (summary)

| Route | Methods | Guard | Scope | Role / entitlement |
|---|---|---|---|---|
| auth/login, auth/logout | POST | public | — | rate-limited |
| auth/me, auth/change-password | GET/POST | tenant | academyId | self |
| dashboard, invoices, invoices/lookup, notifications, receipts/[id], attendance | GET(/POST) | tenant | academyId | any member |
| students, students/[id] | GET/POST/PATCH/DELETE | tenant | academyId | `canManageAcademy` for writes |
| classes, classes/[id] | GET/POST/PATCH/DELETE | tenant | academyId | `canManageAcademy` for writes |
| staff, staff/[id] | GET/POST/PATCH | tenant | academyId | `canManageAcademy` (+ last-owner guard) |
| payments | POST | tenant | academyId | `canManageFinance` |
| reports, reports/pdf | GET | tenant | academyId | `hasReportsAccess` (tier) |
| settings, settings/* | GET/PUT/POST | tenant | academyId | `canManageAcademy` |
| site, site/posts(/[id]) | GET/PUT/POST/PATCH/DELETE | tenant | academyId | `isPremiumTier` (write) / `canManageAcademy` |
| site/inquiries(/[id]) | GET/PATCH | tenant | academyId | any member (see open item) |
| public/site/[slug](/inquiry) | GET/POST | public | slug→academy | `isPremiumTier` + rate-limit + honeypot |
| super-admin/** | GET/POST/PATCH/PUT | SA | — / academyId | `getSuperAdmin` |
| super-admin/tenants/[id]/impersonate | POST | SA | academyId | starts privileged session |

**Automated:** `tests/integration/tenant-isolation.test.ts` (10 tests) provisions a throwaway DB and proves cross-tenant read/update/delete denial across students, classes, invoices, payments, plus the deactivated-user invariant.

**Open item (product decision, not a leak):** `site/inquiries` (CRM leads) is readable/editable by any tenant member including TEACHER. Not a cross-tenant or privilege-escalation issue — a least-privilege *tightening* question. Flagged rather than changed, since it alters intra-tenant user-facing permissions.

---

## 1.3 Payment & Financial Integrity (re-verified under concurrency)

`app/api/payments/route.ts`: `canManageFinance` gate → Serializable transaction → invoice re-read + balance validated inside the tx → idempotency short-circuit → `P2002`/`P2034` handling → audited.

**Live evidence (current build):**
- **Idempotency:** same key twice → `201` then `200 idempotent:true`; **1** DB row.
- **Concurrency:** 6 parallel same-key requests → one `201` + five `200`; **1** DB row.
- **Atomicity:** invoice `amountPaid` correctly summed (1000 + 500 = 1500, status PARTIAL).

**Reversal / void / refund:** these flows **do not exist** in the codebase. Building them is a new feature and is out of scope for hardening — flagged for a product decision rather than implemented.

---

## 1.4 Session & Security Hygiene

| Item | Status | Evidence |
|---|---|---|
| Secure cookie flags | ✅ | `httpOnly: true`, `sameSite: 'lax'`, `secure` in production, on all three cookies |
| Full session revocation on logout | ✅ | logout clears platform + tenant cookies **and** ends the impersonation session server-side; verified all 3 cookies expire |
| No stale session after **password change** | ✅ (new) | `User.sessionEpoch`; tokens carry the epoch; change bumps it and re-issues only the current device. Verified: device2's session → **401** after device1 changes the password |
| No stale session after **role change** | ✅ | role is read live from the DB in `getSessionUser` — never cached in the token |
| Secret hygiene | ✅ | `SESSION_SECRET` fail-closed (throws if unset); `.env`/`TEST_CREDENTIALS.md`/`*.db` git-ignored; no secrets in logs or this report |
| Security headers | ✅ (new) | `next.config.mjs` sets CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS; `X-Powered-By` removed. Verified served on pages + API; app loads with **no CSP console errors** |

> **CSP caveat (honest):** the policy forbids framing, object/embed, cross-origin forms and pins base-uri, but `script-src` still allows `'unsafe-inline'`/`'unsafe-eval'` because the app has no nonce pipeline. A strict nonce-based CSP requires Next 16 `proxy.ts` and is tracked as a follow-up.

---

## Risks introduced by these changes

- **Impersonation resolver touches the core `getSessionUser` path** (every route). Mitigated: acting user is returned in the exact prior shape; 40 automated tests + extensive live checks pass; build/type/lint clean.
- **`sessionEpoch` invalidates all pre-existing tenant sessions on deploy** (tokens lacked the field). One-time forced re-login; acceptable and expected for a security change.
- **Removing `ignoreBuildErrors`** means any future type error now fails the build (intended).
- **CSP** could block a future third-party embed; documented and centralized in `next.config.mjs`.

## What remains open (later phases)

- **Phase 2:** browser-level E2E tests; execute CI on a real runner (workflow authored, not yet run here).
- **Phase 3:** PostgreSQL runtime verification, Redis-backed rate limiter, structured logging/monitoring, backup/restore — **implement + BLOCKED** for live verification (no external infra in this environment, per your direction).
- **Phase 4:** refactor the large components; reduce `any` (88 lint warnings).
- **Phase 5:** full responsive/accessibility QA and dashboard-number verification.
- **Product decisions to confirm:** CRM lead role-tightening; whether refund/void flows should be built.
