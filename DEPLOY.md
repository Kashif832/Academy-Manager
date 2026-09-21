# Deploying Academy Manager

This is the step-by-step runbook to take Academy Manager to production. Two
paths: **Docker Compose** (turnkey, includes automatic HTTPS) or **manual /
PaaS**. Both end with the same required checks.

> **Non-negotiable:** serve over **HTTPS**. Session cookies are marked `Secure`
> when the request is HTTPS (detected via `x-forwarded-proto`). Over plain HTTP
> on a real domain/IP, browsers drop `Secure` cookies and login silently fails.
> The Docker path handles this for you (Caddy terminates TLS).

---

## What you provide

- A server/host with Docker (Option A) or Node 20+ (Option B).
- A **domain** pointing at the host (for real HTTPS).
- A strong `SESSION_SECRET`:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## Option A — Docker Compose (recommended)

Brings up **app + PostgreSQL + Redis + Caddy** (auto-HTTPS via Let's Encrypt).
Migrations run automatically on app start.

```bash
cp .env.production.example .env.production
# edit .env.production: DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, SESSION_SECRET
docker compose --env-file .env.production up -d --build
```

Then seed the platform Super Admin once (see "First run" below).

- HTTPS + `x-forwarded-proto` are handled by Caddy → cookies are `Secure`.
- Redis is wired (`REDIS_URL`) so rate limits hold across instances.
- Health: `https://DOMAIN/api/health` (live), `/api/health/ready` (DB).
- Data persists in the `db-data` volume.

> Local trial without a domain: leave `DOMAIN=localhost` (Caddy issues a local
> cert) and browse `https://localhost`.

---

## Option B — Manual / PaaS (Vercel, Railway, Render, Fly, bare Node)

1. Provision **managed PostgreSQL** and (recommended) **Redis**.
2. Set environment variables (see below).
3. Build and run:
   ```bash
   npm ci
   npx prisma generate
   npx prisma migrate deploy      # take a backup first on an existing DB
   npm run build
   npm start                      # or: node .next/standalone/server.js
   ```
4. Put it behind an HTTPS load balancer/proxy that forwards
   `x-forwarded-proto=https` (nginx/Caddy/Cloud LB/PaaS default). If your TLS
   terminates without that header, set `COOKIE_SECURE=true`.

### Required environment variables

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (pooled for serverless). |
| `SESSION_SECRET` | ✅ | Strong random; rotating it logs everyone out. |
| `REDIS_URL` | ▲ | Recommended; without it rate limits are per-instance. |
| `COOKIE_SECURE` | — | `auto` by default (HTTPS-aware). Force `true`/`false` if needed. |
| `NODE_ENV` | — | `production`. |

---

## First run — create the Super Admin

```bash
# Docker:
docker compose --env-file .env.production exec app node node_modules/prisma/build/index.js migrate deploy   # (already run on boot)
docker compose --env-file .env.production run --rm -e DATABASE_URL=... app npm run seed:super-admin
# Manual:
npm run seed:super-admin
```

This creates the platform Super Admin (`superadmin@academymanager.internal`).
**Change its password immediately** and store real credentials in your secret
manager. Do **not** ship the demo tenant seeds (`prisma:seed`,
`seed:super-admin`) to production.

---

## Post-deploy smoke test (2 minutes)

```bash
curl -fsS https://DOMAIN/api/health          # {"status":"ok",...}
curl -fsS https://DOMAIN/api/health/ready     # {"status":"ready","checks":{"database":"up"}}
```
Then in a browser over HTTPS:
1. Super Admin login → panel loads.
2. Create/enter a tenant; add a student and a fee — persists after refresh.
3. Deactivate a tenant → its users are blocked; impersonating it is read-only
   (red banner, writes rejected). Reactivate → writes work again.

---

## Operations

- **Backups:** `pg_dump -Fc "$DATABASE_URL" -f backup.dump` (restore:
  `pg_restore -d "$TARGET" backup.dump`). A client-tool-free logical
  backup/restore is also provided: `npm run db:backup -- "$DATABASE_URL" snap.json`.
- **Migrations:** `npx prisma migrate deploy` (forward-only; back up first).
- **Rollback:** redeploy the previous app image/commit; for a destructive
  migration, restore from the pre-deploy backup.
- **Health/probes:** liveness `/api/health`, readiness `/api/health/ready` (503
  when DB down — drain the instance).
- **Logs:** structured JSON with secret redaction; ship to your aggregator.
  Alert on readiness 503s, 5xx spikes, repeated 429s (credential stuffing) and
  DB latency.
- **Secret rotation:** rotate `SESSION_SECRET` on suspected compromise (forces
  re-login); deactivate a compromised user/Super Admin (cuts their sessions on
  the next request).

---

## Verified vs. still-yours-to-do

**Verified in this repo (real evidence):** production build, `tsc`/lint clean,
67 unit + 12 Playwright E2E green on a production build + real PostgreSQL,
migrations `deploy` (clean + existing data), backup/restore round-trip,
protocol-aware Secure cookies, tenant isolation, RBAC, plan gates, impersonation
+ inactive-tenant freeze, financial integrity, nonce CSP.

**You must still do (environment-specific — cannot be done from the repo):**
1. Push the repo and let **CI run green on a hosted runner** (workflow is in
   `.github/workflows/ci.yml`, with Postgres + Redis services).
2. Run once on a **staging** environment (HTTPS + managed Postgres + Redis) and
   complete the smoke test before production.
3. Confirm your TLS proxy forwards `x-forwarded-proto=https`.

**Known follow-ups (not blockers):** load-tested to ~1,500 students on one
instance (not beyond); zod validation covers the critical mutations, not all 49
routes; `academy-manager.tsx` not yet split; accessibility is automated-scan
only. See `NEXT_HARDENING_REPORT.md` for the full honest scorecard (~8.8/10).
