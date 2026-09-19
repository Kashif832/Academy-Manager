# Production Deployment & Operations

Academy Manager runs on **PostgreSQL** everywhere — dev, CI and production. This
document reflects the setup that has actually been executed and verified in this
repository (see IMPROVEMENT_REPORT.md for the evidence).

---

## 1. Database — PostgreSQL

The Prisma datasource provider is `postgresql`. Money is `Decimal(12,2)`;
date-only fields are `DATE`; enums are native PostgreSQL `ENUM`s.

**Local / CI (no Docker required):** a real PostgreSQL is provided by the
`embedded-postgres` dev dependency and controlled with:

```bash
npm run db:pg:start    # boots PostgreSQL on :5433, creates the `academy` db
npm run db:pg:status
npm run db:pg:stop
npm run db:pg:reset    # stop + delete the data dir
```

`DATABASE_URL` then points at it (see `.env.example`). Production points
`DATABASE_URL` at your managed PostgreSQL (RDS, Cloud SQL, Neon, etc.); use a
pooled connection for serverless.

### Migrations

Versioned, PostgreSQL-native migrations live in `prisma/migrations/`.

- **Create a migration (dev):** `npx prisma migrate dev --name <change>`
- **Apply in production/CI:** `npx prisma migrate deploy` — applies pending
  migrations, never resets data. Verified against both a **clean** database and
  an **existing-data** database (data preserved).

### Rollback

Prisma migrations are forward-only, so plan rollbacks explicitly:
1. Take a backup first (below) — always.
2. For an additive migration, roll back the *application* to the previous
   release; the extra columns/tables are inert.
3. For a destructive change, restore from the pre-deploy backup, or apply a new
   compensating migration. Never hand-edit an applied migration.

### Backup & restore

Production standard (full PostgreSQL client installed):

```bash
pg_dump  -Fc "$DATABASE_URL" -f backup-$(date +%F).dump      # backup
pg_restore -d "$TARGET_URL" backup-YYYY-MM-DD.dump           # restore
```

This repo also ships a client-tool-free logical backup/restore that has been
executed and verified (row counts match across all tables):

```bash
npm run db:backup  -- "$DATABASE_URL" snapshot.json
npm run db:restore -- "$TARGET_URL"   snapshot.json          # target must be migrated first
node scripts/backup-restore.mjs verify "$SRC" "$TARGET"
```

---

## 2. Environment variables

See `.env.example`. Required in production: `DATABASE_URL`, `SESSION_SECRET`
(strong random — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
Optional: `TEST_DATABASE_URL` (CI), `REDIS_URL` (see §4).

`SESSION_SECRET` is fail-closed (the app throws if unset). Rotating it
invalidates every session immediately — plan a re-login window.

---

## 3. CI / quality gate

`.github/workflows/ci.yml` runs on a PostgreSQL service container and executes:
clean install (`npm ci`) → `prisma generate` → `prisma validate` →
`prisma migrate deploy` (app + test DB) → typecheck → lint → test (unit +
PostgreSQL-backed integration) → production build. **CI fails on any type
error, test failure, lint error or build failure.** One package manager (npm),
one lockfile (`package-lock.json`).

---

## 4. Rate limiting (distributed)

`lib/rate-limit.ts` uses a pluggable store. Set `REDIS_URL` for a shared Redis
store so limits hold across all instances; unset falls back to an in-process
limiter (single instance). **Fail-safe:** if the shared store errors, the
limiter degrades to the in-process limiter rather than failing open — a Redis
outage cannot become an auth-brute-force bypass (regression-tested). Login,
Super Admin login and public inquiry are rate-limited; email keys are hashed so
raw PII is never written to the store; `Retry-After` is returned on 429.

---

## 5. Observability & health

- **Liveness:** `GET /api/health` — process up, no DB touch (200).
- **Readiness:** `GET /api/health/ready` — checks DB connectivity; **503** when
  the database is unreachable so a load balancer stops routing to the instance.
- **Structured logs:** `lib/logger.ts` emits single-line JSON with automatic
  redaction of `password`/`secret`/`token`/`cookie`/`hash`/`session` keys.
- **Correlation IDs:** `lib/http.ts` (`getRequestId`, `withErrorContract`)
  attaches an `x-request-id` to error responses and logs; unexpected throws
  become a redacted, correlated 500 — never a raw stack trace.
- **Audit trail:** all privileged/financial actions are audited with actor
  attribution (incl. `IMPERSONATED_SUPER_ADMIN` + the impersonation session id).

**Recommended production wiring:** point liveness/readiness at your orchestrator
probes; ship the JSON logs to your aggregator; alert on readiness 503s, a spike
in 5xx/`unhandled_route_error`, repeated 429s (credential stuffing), and DB
latency.

---

## 6. Incident response (starter runbook)

- **DB down:** readiness returns 503 → instances drained automatically. Check
  the managed DB status; fail over / restore from backup; verify with
  `GET /api/health/ready`.
- **Suspected credential compromise:** rotate `SESSION_SECRET` (logs everyone
  out); deactivate the affected user/Super Admin (cuts their sessions on the
  next request); review the audit log for their `entityId`.
- **Rogue Super Admin session:** deactivate the Super Admin, or revoke the
  specific `ImpersonationSession` row — access stops on the next request.
- **Bad deploy:** roll the app back to the previous release; if a destructive
  migration was applied, restore from the pre-deploy backup (§1).

---

## 7. Baseline performance (single instance, production build)

Measured with autocannon against `next start` + real PostgreSQL:

| Endpoint | req/s | p50 | p99 |
|---|---|---|---|
| `/api/health` (liveness) | ~550 | 83ms | 264ms |
| `/api/health/ready` (DB) | ~499 | 94ms | 230ms |
| `/api/public/site/[slug]` (DB render) | ~285 | 101ms | 184ms |

No single bottleneck emerged at this scale. Comprehensive per-flow load testing
with large multi-tenant seed volumes is a recommended follow-up before a
high-traffic launch.
