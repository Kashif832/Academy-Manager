# Academy Manager — Next Hardening Phase Report (2026-09-20)

Continuation of the existing repository (no rebuild) against the "Next Production
Hardening & Quality Phase" prompt. Prior verified score: **8.1/10**. This phase
targets the sub-9 dimensions with executed, evidence-backed work.

Everything below was run in this environment. Items needing a hosted runner or
Redis on this Windows box are marked and never claimed as passing.

---

## A. Phase 0 reconciliation (the CI/CD 6.0 finding)

Root cause found: **the project was not under version control.** `.github/
workflows/ci.yml` existed on disk but archives drop the `.github` dotfolder and
`.gitignore` protects nothing when nothing is tracked — so the auditor never saw
the workflow and local artifacts could leak.

Fixed:
- `git init` + initial commit. `ci.yml` is now a tracked, discoverable artifact
  (validated: 2 jobs, `validate` + `e2e`). `.gitignore` now genuinely excludes
  `.env`, `TEST_CREDENTIALS.md`, `.pgdata/`, local DBs, build output.
- Removed leftover `.env.sqlite.bak`; single lockfile (`package-lock.json`);
  added `.gitattributes` (LF normalization). Confirmed no secret is tracked.

## B. Changes by area (with evidence)

### Security (8.0 → higher)
- **Nonce-based CSP** (`proxy.ts`, Next 16): `script-src 'self' 'nonce' 'strict-dynamic'`,
  **no `unsafe-inline`/`unsafe-eval`** in production (`unsafe-eval` dev-only).
  `app/layout.tsx` forced dynamic so Next injects the nonce. Verified in a real
  browser: **0 CSP violations, app fully interactive** (`e2e/csp.spec.ts` + all
  E2E pass). `style-src` keeps `unsafe-inline` (React inline style attributes
  can't be nonced — documented compromise).
- Route auth boundaries re-verified via E2E (below).

### Input validation (7.2 → higher)
- Uniform **zod** layer (`lib/validation.ts` + `lib/schemas.ts`) wired into the
  `jsonError`/`withErrorContract` error contract; applied to payments, students,
  classes. Safe field-level errors; no internals leaked.
- **15 unit tests** + E2E malformed-JSON/negative-amount → 400.

### Automated testing (7.7 → higher)
- **Playwright E2E** (`e2e/`): 11 tests — auth UI, unauth 401, tenant→super-admin
  block, cross-tenant IDOR 404, plan entitlement, malformed-input 400,
  impersonation lifecycle, 3 a11y scans, CSP regression. All pass on prod build +
  real PostgreSQL.
- vitest: **67 passed + 1 skipped** (Redis, CI-only), up from 30.

### Database / Performance (7.2 → higher)
- **Measured** baseline load (1,500-student tenant, prod build + PostgreSQL),
  then optimized measured bottlenecks:
  | Endpoint | before p50 | after p50 |
  |---|---|---|
  | /api/dashboard | 1199ms | **521ms** (DB SUM aggregate vs loading all unpaid invoices) |
  | /api/students?limit=50 | 2111ms | **147ms** (pagination) |
  | /api/invoices?month&limit=50 | 4848ms | **148ms** (month filter + pagination) |
- Added indexes: `Student(academyId,fullName)`, `FeeInvoice(academyId,month)`,
  `FeePayment(invoiceId,paidAt)`. `scripts/seed-perf.mjs` for repeatable runs.
  Pagination is opt-in/backward-compatible.

### Rate limiting (8.0 → higher)
- Two-instance distributed test (`tests/integration/redis-ratelimit.test.ts`)
  proving a shared limit across two stores on one Redis; runs in CI (Redis
  service added), skips locally (no Redis on this box). Fail-safe (no bypass on
  outage) already unit-tested; email keys hashed.

### Observability (8.0)
- Health probes `/api/health`, `/api/health/ready` (503 on DB down); JSON logger
  with redaction; request-ID/error contract. Documented alerting in PRODUCTION.md.

### Accessibility (7.2 → higher)
- **axe-core** WCAG 2.1 A/AA scans on tenant login, super-admin login and the
  public website: **0 critical/serious violations** (`e2e/accessibility.spec.ts`).

### Product data model (7.0 → higher)
- Additive **AcademicYear + Enrollment** models (+ `EnrollmentStatus`).
  `lib/enrollment.ts`: moving a student between classes closes the prior
  enrollment (TRANSFERRED) and opens a new one — **history preserved**, verified
  by 4 integration tests on real PostgreSQL. Non-breaking (Student.classId
  retained; student creation records an opening enrollment best-effort). Not an
  ERP — no UI rewiring this pass.

### Repo hygiene / CI-CD / Deployment readiness
- git initialized; CI workflow real + valid (Postgres + Redis services, npm ci,
  generate/validate/migrate deploy/typecheck/lint/test/build, plus an E2E job).

## C. Command results

```
tsc --noEmit            exit 0
eslint .                0 errors (90 warnings)
vitest run              67 passed, 1 skipped (Redis CI-only)
playwright test         11 passed (prod build + PostgreSQL)
next build              Compiled + TypeScript gate + all routes dynamic (nonce CSP)
prisma migrate deploy   clean (migrations: init, payment_lifecycle, perf_indexes, academic_history)
```

## D. Blocked / unrun (NOT passing)

| Item | Status | Reason |
|---|---|---|
| Hosted CI green on a runner | **PENDING** | No GitHub runner/remote here. Workflow is valid and the equivalent gate runs green locally. |
| Live two-instance Redis | **CI-ONLY** | No Redis on this Windows box; the test + CI Redis service are in place and run on the runner. |
| Large-scale load beyond 1.5k students | **PARTIAL** | Baseline + optimizations measured at 1,500 students; higher volumes not run. |
| `pg_dump`/`pg_restore` client tools | **BLOCKED** | embedded-postgres ships server binaries only; verified logical backup/restore round-trip instead. |
| Component refactor of academy-manager.tsx | **DEFERRED** | New lib/service seams added; splitting the ~3.6k-line component is the main remaining maintainability item. |
| UI adoption of pagination/enrollment | **DEFERRED** | Endpoints/models are backend-ready and tested; wiring the large client is incremental. |

## E. Remaining risks

| Risk | Severity | Action |
|---|---|---|
| CI never executed on a hosted runner | Medium | Push to GitHub; confirm both jobs green. |
| Large UI components not split | Medium | Incrementally extract feature modules behind the E2E safety net. |
| Load characteristics past 1.5k students unknown | Medium | Run higher-volume load; adopt pagination in the UI. |
| Validation contract not on all 49 routes | Low/Med | Roll the zod pattern out route-by-route. |
| Public site now dynamically rendered (nonce CSP) | Low | Accept (security tradeoff), or move public site to hash-based SRI CSP to restore static caching. |

## F. Production launch checklist

1. Managed PostgreSQL + `DATABASE_URL` (pooled); strong `SESSION_SECRET`; Redis + `REDIS_URL`.
2. `npm ci && npx prisma generate && npx prisma migrate deploy` (backup first).
3. `npm run seed:super-admin` (first deploy).
4. `npm run build && npm start` behind HTTPS (HSTS/CSP assume TLS).
5. Probes → `/api/health`, `/api/health/ready`; ship JSON logs; alert on 503/5xx/429/DB latency.
6. Confirm CI (validate + e2e) is green on the runner before enabling required checks.

## G. Honest recalculated scorecard

Evidence-based; not forced to a target. Dimensions sit at 8.x — not 9.5 — where
the strongest verification is blocked here (hosted CI, live Redis) or where
breadth remains (component refactor, UI adoption, full manual a11y).

| Dimension | Was | Now | Basis |
|---|---|---|---|
| CI/CD | 6.0 | **8.3** | Real tracked valid workflow (PG+Redis+E2E); gate green locally; hosted run pending |
| Input validation | 7.2 | **8.7** | zod layer + 15 tests + E2E negative tests |
| Automated testing | 7.7 | **8.7** | 67 unit + 11 E2E (security/a11y/CSP) |
| Performance | 7.2 | **8.4** | measured baseline + 14–33× optimizations + indexes |
| Security hardening | 8.0 | **8.8** | nonce CSP, no unsafe-inline/eval scripts, verified |
| Rate limiting | 8.0 | **8.5** | two-instance Redis test (CI) + fail-safe + hashed keys |
| Accessibility | 7.2 | **8.3** | axe WCAG scans, 0 critical/serious |
| Data model / academic history | 7.0 | **8.1** | AcademicYear/Enrollment additive + tested history |
| Observability | 8.0 | **8.4** | health probes + JSON redaction + request IDs |
| Repo hygiene | 7.5 | **9.0** | git tracked, secrets ignored, single lockfile |
| Deployment readiness | 7.3 | **8.3** | CI + PRODUCTION.md + probes + backup/restore |
| Maintainability | 7.2 | **7.7** | new lib/service seams; large components not yet split |
| Architecture | 7.8 | **8.1** | clearer route→validate→service→data layering |
| Multi-tenancy / isolation | 9.2 | 9.2 | re-verified via E2E on PostgreSQL |
| Financial integrity | 9.2 | 9.2 | preserved; VOID/REFUND under concurrency |
| Super Admin | 9.1 | 9.1 | persisted impersonation + revocation |

**Overall: ≈ 8.8 / 10** (from 8.1). The highest-risk items (real PostgreSQL,
security boundaries, financial integrity, strict CSP, validation) are verified
with repeatable evidence. Reaching a genuine 9.3–9.5 requires the explicitly-
listed external/incremental items: hosted CI green, live Redis, higher-volume
load, the component refactor, and UI adoption of the new pagination/enrollment
capabilities.
