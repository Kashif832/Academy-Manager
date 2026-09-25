# 1. Code Walkthrough — Understanding What Was Built

## The big picture (plain English)

Academy Manager is one web application that serves **three kinds of users**:

1. **A tenant (academy) staff member** — an academy owner/admin/teacher who logs in
   and runs their academy: students, classes, attendance, fees, staff, reports,
   and their own public website.
2. **A parent / member of the public** — who visits an academy's public website,
   reads about it, submits an admission inquiry, or looks up a fee invoice.
3. **The platform Super Admin** — you / the company — who manages every academy
   (create, edit, activate/deactivate, review plan upgrades) and can securely
   "impersonate" any academy to help it directly.

The word **tenant** = one academy. Every academy's data is walled off from every
other academy. A tenant can *only ever* see its own students, fees, etc. This is
the single most important idea in the codebase, and it is enforced on the server.

## Tech stack (what each piece is)

- **Next.js 16 (App Router)** — the web framework. It serves both the pages the
  user sees *and* the API (the back-end). One project, one language.
- **React 19 + TypeScript + Tailwind CSS v4** — how the screens are built and styled.
- **PostgreSQL** — the database (where all data lives).
- **Prisma 6** — the translator between our code and the database. Instead of
  writing raw SQL, we call `prisma.student.findMany(...)`.
- **Vitest** (automated tests) + **Playwright** (browser tests) — prove it works.

## Folder structure — what each folder/file is for

```
academy-manager/
├── app/                     ← Every URL in the app lives here (Next.js App Router)
│   ├── page.tsx             ← "/" — the tenant app entry (renders academy-manager.tsx)
│   ├── site/[slug]/page.tsx ← "/site/<academy>" — an academy's PUBLIC website
│   ├── super-admin/         ← "/super-admin" — the platform console + its login
│   └── api/                 ← THE BACK-END. 49 endpoints. Every folder = one URL.
│                              e.g. app/api/students/route.ts = /api/students
│
├── components/              ← The actual on-screen UI
│   ├── academy-manager.tsx  ← The whole tenant-facing app (dashboard, students,
│   │                          fees, attendance, staff, reports, website, settings)
│   ├── super-admin.tsx      ← The whole Super Admin console
│   ├── public-site-view.tsx ← The public academy website + inquiry form
│   └── ui/                  ← Small reusable building blocks (buttons, inputs…)
│
├── lib/                     ← The "brain" — shared logic used by many endpoints
│   ├── prisma.ts            ← The one shared database connection
│   ├── session.ts           ← Tenant login sessions (who is logged in, which academy)
│   ├── super-session.ts     ← Super Admin sessions + impersonation logic
│   ├── permissions.ts       ← Which role (OWNER/ADMIN/TEACHER) can do what
│   ├── tiers.ts             ← Plan tiers (Basic/Standard/Premium) and their limits
│   ├── fees.ts              ← Fee/invoice/payment calculations
│   ├── enrollment.ts        ← Moving students between classes, keeping history
│   ├── rate-limit.ts        ← Brute-force / abuse protection on logins & writes
│   ├── validation.ts +      ← Checks incoming data is valid before it touches the DB
│   │   schemas.ts
│   ├── http.ts              ← Standard error responses + request IDs (for logs)
│   ├── logger.ts            ← Structured logs, with passwords/secrets redacted
│   ├── cookies.ts           ← Sets the login cookie correctly (Secure over HTTPS)
│   ├── audit.ts             ← Records sensitive actions (who did what, when)
│   ├── pdf.ts / reports.ts  ← Report + receipt PDF generation
│   └── site-content.ts,     ← Default content for a new academy's public website
│       settings-content.ts
│
├── prisma/
│   ├── schema.prisma        ← THE DATABASE STRUCTURE — every table & column
│   ├── migrations/          ← The history of every DB change (never edit by hand)
│   └── seed.ts              ← Fills a fresh DB with one demo academy of sample data
│
├── scripts/
│   ├── pg.mjs               ← Starts/stops a local PostgreSQL (no Docker needed)
│   ├── seed-super-admin-demo.ts ← Creates the Super Admin + 4 demo academies
│   ├── backup-restore.mjs   ← Logical DB backup/restore
│   ├── seed-perf.mjs        ← Loads lots of data to test performance
│   └── create-academy.ts    ← Create one academy from the command line
│
├── tests/                   ← Vitest automated tests (unit + PostgreSQL integration)
├── e2e/                     ← Playwright browser tests (real login flows, a11y, CSP)
├── proxy.ts                 ← Security headers + Content-Security-Policy (nonce-based)
├── .github/workflows/ci.yml ← Runs all tests automatically on every push to GitHub
├── Dockerfile,              ← One-command production deploy (app+DB+Redis+HTTPS)
│   docker-compose.yml,
│   Caddyfile
├── DEPLOY.md                ← Full deployment runbook
└── HANDOVER.md              ← One-page technical orientation
```

## How a single request flows (worth understanding once)

Example: a teacher clicks **"Add student"**.

1. `components/academy-manager.tsx` sends `POST /api/students` with the form data.
2. `app/api/students/route.ts` runs on the server. It:
   - **Authenticates** — `lib/session.ts` reads the login cookie → "this is user X
     of academy Y". The academy ID comes from the *session*, never from the browser.
   - **Authorises** — `lib/permissions.ts` checks user X's role may create students.
   - **Validates** — `lib/validation.ts` + `schemas.ts` check the data is well-formed.
   - **Checks plan limits** — `lib/tiers.ts` (e.g. Basic plan caps student count).
   - **Writes** — `prisma.student.create({ data: { academyId: Y, ... } })`.
3. The new student is returned as JSON and the screen updates.

The key takeaway: **the server decides which academy you belong to.** A malicious
browser cannot ask for another academy's data — the tenant ID is always taken from
the verified session. This is proven by the tenant-isolation tests.

## Where the "complex / non-obvious" parts are (and are commented)

These are the tricky bits — each has explanatory comments in the code:

- `lib/super-session.ts` — **impersonation.** When the Super Admin "enters" an
  academy, it does *not* borrow that academy's password. A separate, server-stored
  `ImpersonationSession` record is created; ending/revoking/expiry all cut access on
  the next request. Read this file to understand the security model.
- `lib/rate-limit.ts` — pluggable limiter: uses Redis if `REDIS_URL` is set (shared
  across servers), otherwise an in-memory fallback; **fails safe** (an outage never
  lets an attacker bypass the limit).
- `app/api/payments/route.ts` + `payments/[id]/reverse/route.ts` — **money.** Uses
  serializable DB transactions + idempotency keys so a double-click can't double-charge,
  and VOID/REFUND **never delete** history (they add reversing records).
- `lib/cookies.ts` — sets the session cookie `Secure` only when the request is truly
  HTTPS (via `x-forwarded-proto`). This one file is why login "silently failed" over
  plain HTTP before — worth understanding before deploying.
- The **inactive-tenant freeze**: a deactivated academy becomes read-only. Writes are
  rejected (403) everywhere — *even* while the Super Admin is impersonating it.

## The video that goes with this section

A **15–20 minute recorded screen-share** walking through the above live is required.
A ready-to-read script (which files to open, in what order, what to say) is in
[`09-Video-Recording-Scripts.md`](09-Video-Recording-Scripts.md#video-1).
