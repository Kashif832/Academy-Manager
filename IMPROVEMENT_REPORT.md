# Academy Manager — Improvement Report (2026-09-20)

Continuation of the existing codebase (no rebuild) against the "Master Claude
Improvement Prompt". Focus: make the previously *documented* production
capabilities **real and verified** — chiefly PostgreSQL, CI as an enforced gate,
distributed rate limiting, financial lifecycle, and observability.

Everything below was executed in this environment. Blocked/unrun items are
labeled and never reported as passing.

---

## Headline: PostgreSQL is now real

The single biggest gap ("PostgreSQL documented, not real") is closed. A genuine
**PostgreSQL 18.4** runs locally and in CI via the `embedded-postgres` binaries
(no Docker needed) — `npm run db:pg:start`. The Prisma provider is now
`postgresql` with native types, a fresh Postgres migration history, and the full
app + test suite verified against it.

---

## A. Changes by area

### Security
- **Rate limiter → distributed & fail-safe** (`lib/rate-limit.ts`): pluggable
  store — Redis (`REDIS_URL`) or in-process; on shared-store outage it degrades
  to the in-process limiter instead of failing open (no auth-brute-force
  bypass). Email keys are SHA-256 hashed so raw PII never enters the store.
- **Financial reversal authorization**: new `POST /api/payments/[id]/reverse`
  is finance-role-only, tenant-scoped, Serializable, idempotent, audited.
- Carried forward & re-verified on Postgres: tenant isolation/IDOR, RBAC, plan
  entitlement gates, dedicated-session impersonation with server-side
  revocation, session-epoch password invalidation, security headers.

### Database
- Provider converted **SQLite → PostgreSQL**; `@db.Decimal(12,2)` money,
  `@db.Date` date-only fields, native enums.
- Fresh **PostgreSQL migration history** (`prisma/migrations/`, SQLite DDL
  discarded). `migrate deploy` verified on clean + existing-data DBs.
- **Backup/restore** executed and verified (row counts match across all tables).
- Reproducible local/CI Postgres via `scripts/pg.mjs` + `npm run db:pg:*`.

### Testing
- Test suite runs against **real PostgreSQL**; **48 tests** (up from 30).
- New: PostgreSQL-backed tenant isolation (incl. Decimal precision + composite
  unique enforced by the DB), impersonation revocation rules, rate-limit
  fail-safe (no bypass on outage), logger redaction, VOID/REFUND arithmetic.

### CI/CD
- `.github/workflows/ci.yml` rewritten: **PostgreSQL service container**, `npm
  ci`, generate/validate/migrate-deploy/typecheck/lint/test/build; fails on any
  type/test/lint/build error. Standardized on **npm** (removed `pnpm-lock.yaml`).

### Performance
- Baseline load measured on a **production build + real Postgres** (single
  instance): liveness ~550 req/s, readiness(DB) ~499 req/s, public site render
  ~285 req/s; p99 < 270ms. No bottleneck required code changes.

### Observability
- `GET /api/health` (liveness) and `GET /api/health/ready` (readiness → 503 when
  DB down). Structured JSON logger with secret redaction (`lib/logger.ts`).
  Request-ID / safe-error contract (`lib/http.ts`).

### Architecture
- New service/util seams: `lib/http.ts`, `lib/logger.ts`, `lib/rate-limit.ts`
  store abstraction, `scripts/pg.mjs`, `scripts/backup-restore.mjs`. Full split
  of the large UI components is **deferred** (see Remaining Risks).

### UX
- No visual redesign (per instructions). Health/observability are backend-only.
  Responsive/theme work from the prior phase is unchanged.

### Product Data Model
- `PaymentStatus` (COMPLETED/VOID/REFUNDED) + reversal fields added — payments
  are never deleted; history preserved. AcademicYear/Enrollment **not** added
  (optional per prompt; deferred to avoid ERP creep — see Remaining Risks).

---

## B. Key changed files

| File | Why |
|---|---|
| `prisma/schema.prisma` | provider→postgresql; native Decimal/Date/enums; `PaymentStatus` + reversal fields; earlier impersonation/session-epoch models |
| `prisma/migrations/*` | fresh PostgreSQL-native migration history |
| `lib/rate-limit.ts` | pluggable Redis/in-process store; fail-safe; PII-safe keys; async API |
| `app/api/{auth,super-admin/auth}/login`, `.../inquiry/route.ts` | await async rate limiter; hashed email keys |
| `app/api/payments/[id]/reverse/route.ts` | new VOID/REFUND lifecycle endpoint |
| `lib/fees.ts` | `reversedInvoiceState` reversal arithmetic (tested) |
| `lib/logger.ts`, `lib/http.ts` | structured logging + request-ID/error contract |
| `app/api/health/route.ts`, `app/api/health/ready/route.ts` | liveness/readiness |
| `scripts/pg.mjs`, `scripts/backup-restore.mjs` | run real Postgres; backup/restore |
| `.github/workflows/ci.yml` | Postgres-service CI gate on npm |
| `tests/**` | Postgres-backed + new regression tests |
| `next.config.mjs` | (prior) security headers; real TS build gate |
| `package.json` | npm-only; `pg`/`ioredis`/`embedded-postgres`; db:pg/backup scripts |
| `PRODUCTION.md`, `.env.example` | tested Postgres/CI/rate-limit/observability setup |

---

## C. Command evidence

```
prisma generate          ✔ Generated Prisma Client (v6.19.3)
prisma validate          The schema is valid 🚀
prisma migrate deploy    clean DB: all migrations applied; existing DB: No pending, data intact (5 academies)
tsc --noEmit             exit 0
eslint .                 0 errors (89 warnings)
vitest run               7 files, 48/48 passed  (against real PostgreSQL)
next build               Compiled + TypeScript gate + 38/38 pages
```

**Live on PostgreSQL:** cross-tenant IDOR → 404; TRIAL reports gate → 403,
BASIC → 200; impersonate inactive tenant → 200, revoke → 401; payment idempotency
+ 8-way concurrency → exactly 1 row, atomic balance; login rate-limit → 429 +
Retry-After; VOID → status VOID, balance reversed, record preserved, double-VOID
idempotent, TEACHER → 403; health live/ready → 200, readiness reports DB latency.

**PostgreSQL specifics verified:** native `ENUM`/`DATE`/`DECIMAL(12,2)` DDL;
Decimal precision round-trip; `@@unique` enforced by the DB; Serializable
concurrency; `migrate deploy` clean+existing; backup/restore row-count parity.

---

## D. Blocked / unrun (NOT passing)

| Item | Status | Reason |
|---|---|---|
| CI on a real GitHub runner | **BLOCKED** | No runner/remote here. Workflow authored; the equivalent gate was run locally (§C). |
| Live Redis multi-instance rate limiting | **BLOCKED** | No Redis available. Redis store implemented; fail-safe + logic unit-tested; live cross-instance not exercised. |
| Full load test with large multi-tenant seeds | **PARTIAL** | Baseline measured on prod build; large-volume per-flow load testing not run. |
| `pg_dump`/`pg_restore` (OS client tools) | **BLOCKED** | `embedded-postgres` bundles only server binaries. Documented for prod; a logical backup/restore round-trip was executed & verified instead. |
| Browser E2E suite | **NOT ADDED** | Route/behaviour covered by integration + live HTTP checks; a Playwright E2E suite is a recommended follow-up. |

---

## E. Remaining risks

| Risk | Severity | Recommended action |
|---|---|---|
| CI never executed on a real runner | Medium | Push to GitHub; confirm the workflow goes green on the Postgres service. |
| Rate limiter unproven across instances | Medium | Provision Redis, set `REDIS_URL`, verify limits hold across 2+ instances. |
| `academy-manager.tsx` (~3.6k lines) not split | Medium | Continue incremental extraction (one feature boundary at a time) with regression tests. |
| Validation contract not rolled out to all 49 routes | Medium | Apply the `lib/http.ts` pattern (+ a schema validator) route-by-route; the reversal endpoint is the exemplar. |
| No academic-year/enrollment history model | Low/Medium | Decide if in-scope; if yes, add minimal AcademicYear/Enrollment without ERP expansion. |
| Load characteristics at scale unknown | Medium | Run large-seed load tests; add pagination/indexes where data shows need. |
| Full a11y/responsive re-audit not repeated this pass | Low | Re-run the prior QA checklist in real browsers before launch. |

---

## F. Deployment checklist

1. Provision managed PostgreSQL; set `DATABASE_URL` (pooled) and a strong `SESSION_SECRET`.
2. (Recommended) Provision Redis; set `REDIS_URL`.
3. `npm ci && npx prisma generate`.
4. `npx prisma migrate deploy` (take a backup first).
5. `npm run seed:super-admin` (first deploy only).
6. `npm run build && npm start` behind HTTPS (security headers/HSTS assume TLS).
7. Wire probes: liveness `/api/health`, readiness `/api/health/ready`.
8. Ship JSON logs to your aggregator; alert on 503 readiness, 5xx spikes, repeated 429s, DB latency.
9. Verify CI is green on the runner before enabling required-checks/merge.

---

## G. Honest scorecard (evidence-based)

| Dimension | Score | Basis |
|---|---|---|
| Database (production readiness) | 9 | Real Postgres, native types, migrations, deploy clean+existing, backup/restore — all executed |
| Multi-tenant isolation | 9 | Postgres integration + live IDOR checks |
| Authentication & sessions | 8.5 | HMAC+bcrypt, epoch invalidation, dedicated impersonation, rate-limited |
| Authorization / RBAC | 8.5 | Central matrix, live-verified incl. reversal |
| Financial integrity & lifecycle | 9 | Serializable + idempotency + concurrency + VOID/REFUND, verified |
| Rate limiting | 8 | Distributed-capable + fail-safe + tested; live Redis not exercised |
| Observability | 8 | Health probes, JSON logs w/ redaction, request IDs, audit trail |
| Testing | 7.5 | 48 tests incl. Postgres integration; E2E + full route coverage pending |
| CI/CD | 7.5 | Enforced gate authored + run locally; not yet green on a hosted runner |
| Input validation / error contract | 7 | Contract helper + applied to new/critical routes; full rollout pending |
| Performance | 7 | Prod-build baseline measured; large-scale load pending |
| Secrets & config hygiene | 8.5 | fail-closed secret, gitignored, single lockfile, `.env.example` |
| Architecture / maintainability | 7 | New service seams; large UI components not yet split |
| Product data model | 7.5 | Payment lifecycle added; academic history deferred by choice |
| Accessibility / responsive | 7.5 | From prior phase; not re-audited this pass |

**Overall: ≈ 8.4 / 10.** Up from 7.8. The production-blocking database gap is
closed and verified; the remaining distance to 9.0–9.5 is dominated by items
that need external infrastructure (CI runner, Redis, scale load testing) and
incremental breadth (E2E, validation rollout, component refactor) rather than
architectural risk. Not inflated: several dimensions sit at 7–8 precisely
because their strongest verification is blocked here and is reported as such.
