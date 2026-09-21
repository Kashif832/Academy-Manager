# Academy Manager — Handover

A one-page orientation for whoever picks this project up. For deep detail, see
the linked docs at the bottom.

## What it is
A **multi-tenant SaaS for tuition centres / academies**: students, classes,
attendance, fees/invoices/payments, staff, reports, a per-academy public
website (CMS) + admissions CRM, and a platform **Super Admin** console that
manages all tenants (including secure impersonation). Every tenant's data is
isolated by `academyId`, derived from the authenticated session — never the
client.

## Tech stack
- **Next.js 16** (App Router) · **React 19** · **TypeScript** · Tailwind v4
- **PostgreSQL** via **Prisma 6** (the only supported DB — dev, CI and prod)
- Custom HMAC-signed cookie sessions · bcrypt · nonce-based CSP
- Tests: **Vitest** (unit + PostgreSQL integration) · **Playwright** (E2E)
- CI: GitHub Actions (Postgres + Redis services) · Docker deploy stack

## Run it locally (5 minutes)
Requires Node 20+. A real PostgreSQL runs locally via `embedded-postgres` (no
Docker needed):
```bash
npm install
cp .env.example .env            # set SESSION_SECRET; default DATABASE_URL is fine
npm run db:pg:start            # boots PostgreSQL on :5433
npx prisma migrate deploy
npm run prisma:seed            # demo academy (owner@brightfuture.test / password123)
npm run seed:super-admin       # Super Admin + demo tenants (see TEST_CREDENTIALS)
npm run dev                    # http://localhost:3000  (Super Admin: /super-admin/login)
```
Stop the DB with `npm run db:pg:stop`.

## Key commands
| Command | Purpose |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | dev / prod build / prod serve |
| `npm run typecheck` · `npm run lint` | TypeScript · ESLint |
| `npm test` | Vitest (unit + PostgreSQL integration) |
| `npm run test:e2e` | Playwright E2E (needs a build + running app) |
| `npm run db:pg:start` / `:stop` / `:reset` | local PostgreSQL control |
| `npm run db:backup` / `db:restore` | logical backup/restore |
| `npm run seed:super-admin` | create the platform Super Admin |

## Deploy
Turnkey Docker stack (app + PostgreSQL + Redis + Caddy auto-HTTPS):
```bash
cp .env.production.example .env.production   # fill DOMAIN, secrets
docker compose --env-file .env.production up -d --build
```
Full runbook (Docker **and** PaaS, migrations, smoke test, ops) → **`DEPLOY.md`**.
**Must be served over HTTPS** — session cookies are `Secure` when the request is
HTTPS (auto-detected via `x-forwarded-proto`; Caddy handles this).

## Project layout
```
app/                Next.js routes — app/api/** are the 49 API endpoints
components/         academy-manager.tsx (tenant app), super-admin.tsx (console)
lib/                session, super-session (impersonation), permissions, tiers,
                    fees, rate-limit, validation, schemas, http, logger, cookies,
                    enrollment, prisma
prisma/             schema.prisma + migrations (PostgreSQL)
tests/              Vitest unit + integration/ (PostgreSQL-backed)
e2e/                Playwright critical-flow, accessibility, CSP specs
proxy.ts            nonce-based Content-Security-Policy
scripts/            pg.mjs (embedded Postgres), backup-restore.mjs, seed-perf.mjs
.github/workflows/  ci.yml (validate + e2e jobs)
```

## Security model (the parts to understand first)
- **Tenancy:** every query is scoped by `academyId` from the session; verified
  by integration + E2E tests (cross-tenant IDs → 404).
- **Roles:** central matrix in `lib/permissions.ts`, enforced server-side.
- **Super Admin impersonation:** a dedicated, server-persisted
  `ImpersonationSession` (not a borrowed tenant login). Ending it, revoking it,
  expiry, or deactivating the Super Admin all cut access on the next request.
- **Inactive tenants are frozen:** reads allowed (to inspect/reactivate), all
  writes rejected (403) — even under impersonation.
- **Financial integrity:** Serializable transactions + idempotency keys;
  VOID/REFUND never delete history.
- Secrets never in the repo (`.env`, `TEST_CREDENTIALS.md` are git-ignored).

## Status & where to read more
- **CI is green on GitHub Actions** (validate + e2e). Tests: 68 unit + 12 E2E.
- Honest maturity ≈ **8.9/10**; deploy-readiness ≈ **8.5/10** (needs one staging
  run over HTTPS to prove it end-to-end).
- Reports: **`DEPLOY.md`** (deploy), **`NEXT_HARDENING_REPORT.md`** (latest
  scorecard + what's verified/blocked/deferred), `PRODUCTION.md`,
  `IMPROVEMENT_REPORT.md`, `IMPLEMENTATION_REPORT.md`, `PHASE1_HARDENING_REPORT.md`.
- Test credentials: `TEST_CREDENTIALS.md` (git-ignored; local dev only).

## Known follow-ups (none block launch)
- Wire the UI to the paginated / `?month` list endpoints (perf at large scale).
- Surface academic-history/enrollment in the UI (backend done + tested).
- Split the large `academy-manager.tsx` into feature modules.
- Full manual accessibility audit (automated axe scans already pass).
