# 4. QA/QC — How to Test It

## Part 1 — Automated tests (run these first, they prove the core works)

From the project folder, with the local DB running (`npm run db:pg:start`):

```bash
npm run typecheck     # TypeScript is consistent (no type errors)
npm run lint          # code style is clean
npm test              # Vitest: 68 unit + PostgreSQL integration tests
npm run test:e2e      # Playwright: 12 real-browser flows (needs a build + running app)
```
**Expected:** typecheck/lint clean; ~68 unit tests pass; 12 E2E pass.
*(Tip: the E2E suite logs in repeatedly and can trip the 5-logins-per-minute
super-admin rate limit — if an E2E login test flakes, wait 60 seconds and re-run.)*

## Part 2 — Manual click-through checklist

Log in as `owner@brightfuture.test` (password `password123`) unless noted.
For each row: **do the action → confirm the expected result.**

### Tenant app
| Do this | Expect |
|---------|--------|
| Log in with correct password | Lands on Dashboard with stats |
| Log in with wrong password | "Invalid email or password" (no login) |
| Dashboard | Student count, fees collected, outstanding, attendance all show numbers |
| Students → Add student | New student appears in the list immediately |
| Students → Edit a student | Change persists after page refresh |
| Classes → Add class | Class appears; can be picked when adding students |
| Attendance → pick class + today → mark Present/Absent → Save | Reopening the same class/date shows the saved marks |
| Fees → record a payment on a Pending invoice | Status changes to Paid/Partial; a receipt is available |
| Fees → void/refund a payment | Invoice reverts; history still shows the original + the reversal (nothing deleted) |
| Reports → export PDF | A PDF downloads with the right figures |
| Website → edit content → Save | `/site/bright-future` shows the new content |
| Settings → Change password → log out → log in with new password | Works |
| Settings → request a plan upgrade | Request appears for the Super Admin to review |
| Log out | Returns to login; back button doesn't re-enter the app |

### Multi-tenant isolation (the most important security test)
| Do this | Expect |
|---------|--------|
| Log in as Academy A owner, note a student's ID from the URL/network | — |
| Log in as Academy B owner, try to open Academy A's student ID | **404 / not found** — B can never see A's data |

### Public site
| Do this | Expect |
|---------|--------|
| Visit `/site/bright-future` logged out | Public page renders |
| Submit an admission inquiry | Confirmation shown; inquiry appears in that academy's Admissions inbox |

### Super Admin
Log in at `/super-admin/login` as `superadmin@academymanager.internal`.
| Do this | Expect |
|---------|--------|
| Dashboard | All academies listed with plan + status |
| Create a tenant | New academy + owner created; owner can log in |
| Edit a tenant → Deactivate | That academy's users can no longer log in |
| Impersonate the deactivated tenant | You can view it, but a red "read-only" banner shows and any write is rejected (403) |
| Reactivate it | Writes work again; users can log in |
| Approve a pending plan request | Academy's plan tier changes |
| Exit impersonation | Returns to the Super Admin console |

## Part 3 — Known bugs & limitations (honest list — read before demoing)

These are **not blockers**, but you should know them:

- **No live payment gateway.** Fees are recorded manually; plan upgrades are
  approved by the Super Admin. The app does not charge cards. *(By design.)*
- **No email / SMS / WhatsApp.** No automated notifications are sent to parents.
- **Large UI lists aren't paginated yet.** The backend endpoints support
  pagination and are fast, but the on-screen lists still render in full. Fine up to
  ~1,500 students on one instance; beyond that, wire the UI to the paged endpoints.
- **Academic-history / enrollment** is built and tested in the backend but **not yet
  surfaced in the UI.**
- **`components/academy-manager.tsx` is one large file** (~3.6k lines). It works and
  is tested, but should be split into modules for easier future editing.
- **Accessibility** is covered by automated axe scans only — no full manual audit yet.
- **Rate limiting** is per-instance unless `REDIS_URL` is set. Set Redis if you run
  more than one app instance.
- **Load tested** to ~1,500 students on a single instance, not beyond.

The full, honest engineering scorecard (~8.8/10) is in the repo's
`NEXT_HARDENING_REPORT.md`.

## Part 4 — Reset data / create fresh sample data for a clean demo

**Full reset (wipes everything, gives a clean database + fresh demo data):**
```bash
npm run db:pg:reset          # DESTROYS the local DB and its data
npm run db:pg:start
npx prisma migrate deploy    # recreate the tables
npm run prisma:seed          # demo academy: Bright Future
npm run seed:super-admin     # Super Admin + 4 demo academies
```
- The seed scripts are **safe to re-run** — they skip any academy/Super Admin that
  already exists (matched by slug/email), so you can top up without duplicating.
- **Large demo dataset** (for performance testing): `node scripts/seed-perf.mjs`.
- **Back up before a live demo** so you can restore instantly:
  `npm run db:backup -- "$DATABASE_URL" demo-snapshot.json`
  (restore: `npm run db:restore -- "$DATABASE_URL" demo-snapshot.json`).
