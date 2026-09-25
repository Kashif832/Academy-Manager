# 3. Deployment Instructions — How to Put It Live

Written for someone doing this **for the very first time**. Assumes nothing.
For the exhaustive runbook (rollbacks, ops, probes) see the repo's `DEPLOY.md`.

> **The one rule you cannot break:** the app must be served over **HTTPS**.
> The login cookie is marked `Secure` on HTTPS. Over plain `http://` on a real
> domain, browsers silently drop the cookie and **login appears to fail with no
> error**. The Docker option below handles HTTPS for you automatically.

---

## Part 1 — Run it on your own computer first (10 minutes)

Do this once locally so you've seen it work before going live.

**You need:** [Node.js 20 or newer](https://nodejs.org) installed. Nothing else —
a real PostgreSQL is bundled and started by a script (no Docker for local).

```bash
# 1. Install the project's dependencies
npm install

# 2. Create your settings file from the template
cp .env.example .env
#    Open .env and set SESSION_SECRET to any long random string. Generate one with:
#    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Start the local database
npm run db:pg:start          # PostgreSQL boots on port 5433

# 4. Create the database tables
npx prisma migrate deploy

# 5. Fill it with demo data + accounts
npm run prisma:seed          # one demo academy (owner@brightfuture.test / password123)
npm run seed:super-admin     # Super Admin + 4 demo academies (see credentials/)

# 6. Start the app
npm run dev                  # open http://localhost:3000
```
- Tenant app: `http://localhost:3000` — log in with any account in `credentials/`.
- Super Admin: `http://localhost:3000/super-admin/login`.
- Stop the database when done: `npm run db:pg:stop`.

---

## Part 2 — Put it live (production)

### Option A — Docker (recommended, easiest, includes automatic HTTPS)

Brings up **app + PostgreSQL + Redis + Caddy** (Caddy gets a free HTTPS
certificate automatically). Database migrations run on their own at startup.

**You need:** a server with Docker installed, and a **domain name** pointed at
that server's IP address.

```bash
# 1. Create the production settings file
cp .env.production.example .env.production
#    Edit .env.production and fill in:
#      DOMAIN=app.youracademy.com      ← your real domain
#      ACME_EMAIL=you@youracademy.com  ← for the HTTPS certificate
#      POSTGRES_PASSWORD=<strong password>
#      SESSION_SECRET=<64 random hex chars — generate as shown above>

# 2. Build and start everything
docker compose --env-file .env.production up -d --build

# 3. Create the Super Admin account (once)
docker compose --env-file .env.production run --rm app npm run seed:super-admin
#    Then LOG IN and change its password immediately.
```
Verify: open `https://app.youracademy.com/api/health` → should say `{"status":"ok"}`.

> Trying it without a domain? Set `DOMAIN=localhost` and browse `https://localhost`
> (Caddy issues a local certificate).

### Option B — Managed host / PaaS (Vercel, Railway, Render, Fly, bare Node)

1. Provision a **managed PostgreSQL** database and (recommended) a **Redis** instance.
2. Set the environment variables (see [`example.env`](example.env) — every setting
   explained one line each).
3. Build & run:
   ```bash
   npm ci
   npx prisma generate
   npx prisma migrate deploy      # take a DB backup first if it already has data
   npm run build
   npm start
   ```
4. Put it behind an HTTPS proxy/load balancer that forwards the header
   `x-forwarded-proto=https` (most PaaS do this by default). If yours terminates
   TLS without forwarding that header, set `COOKIE_SECURE=true`.
5. Create the Super Admin once: `npm run seed:super-admin`, then change its password.

> **Do not** run `npm run prisma:seed` or `seed:super-admin` demo tenants on a real
> production database except to create the *one* Super Admin. The demo academies are
> for testing only.

---

## Full list of accounts, services & API keys needed

Academy Manager is deliberately **self-contained** — it does not depend on many
third-party paid services. Here is the honest, complete list.

| Thing | Required? | Where it comes from | Notes |
|-------|-----------|---------------------|-------|
| **Server / hosting** | ✅ | Any VPS (DigitalOcean, Hetzner, AWS EC2…) with Docker, **or** a PaaS (Railway/Render/Fly/Vercel) | Runs the app |
| **Domain name** | ✅ | Any registrar (Namecheap, GoDaddy, Cloudflare) | Needed for real HTTPS |
| **PostgreSQL database** | ✅ | Provisioned by Docker Compose automatically, **or** a managed DB (Neon, Supabase, RDS, Railway) | The only mandatory data store |
| **`SESSION_SECRET`** | ✅ | You generate it (command above) | Not a purchased key — a random string you create |
| **Redis** | ▲ Recommended | Docker Compose provides it, or managed (Upstash, Redis Cloud) | Only needed if you run **more than one** app instance; without it rate-limiting is per-instance |
| **HTTPS certificate** | ✅ | **Free & automatic** via Caddy (Docker option) or your PaaS | No manual purchase |
| **Payment gateway (Stripe etc.)** | ❌ Not used | — | The app does **not** process card payments. Plans are set administratively; fee payments are recorded manually (cash/other). |
| **WhatsApp / SMS API** | ❌ Not used | — | No messaging integration is built. If added later, this is where its key would go. |
| **Email service** | ❌ Not used | — | No transactional email is currently sent. |

**In short:** to go live you need a **host, a domain, a database, and a session
secret**. Everything else (HTTPS, Redis) is handled by the Docker stack or is
optional. There are **no third-party API keys to buy** for the current feature set.

---

## The exact commands, in order (Docker production)

```bash
cp .env.production.example .env.production          # then edit it
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production run --rm app npm run seed:super-admin
curl -fsS https://YOUR_DOMAIN/api/health            # expect {"status":"ok",...}
curl -fsS https://YOUR_DOMAIN/api/health/ready      # expect database "up"
```

---

## How to safely update the product later (without breaking what's live)

1. **Back up the database first**, always:
   `pg_dump -Fc "$DATABASE_URL" -f backup.dump`
   (or the bundled `npm run db:backup -- "$DATABASE_URL" snapshot.json`).
2. Pull the new code (`git pull`) — or deploy the new image.
3. **Docker:** `docker compose --env-file .env.production up -d --build`
   — migrations run automatically on startup.
   **PaaS/manual:** `npm ci && npx prisma generate && npx prisma migrate deploy && npm run build`, then restart.
4. **Smoke test** (2 minutes): `/api/health` and `/api/health/ready` return OK;
   log in; create a student + a fee and confirm they persist after refresh.
5. **If something is wrong:** redeploy the previous image/commit. For a bad
   *database* migration, restore the backup you took in step 1. Database
   migrations are forward-only — the backup is your rollback.

> Migrations are the only part that can't be trivially undone, which is why step 1
> (backup) is non-negotiable before every update.
