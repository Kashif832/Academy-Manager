# 8. Future Development Guide

For whoever adds features later. Explains what's shared ("the engine") vs. what's
specific, and where new work goes.

## The shared "engine" vs. product-specific parts

Academy Manager is a **single product**, but it has a clear shared engine that
handles the cross-cutting concerns every screen relies on:

**Shared engine (in `lib/`) — touch carefully, it affects everything:**
- **Login & sessions** — `lib/session.ts` (tenant users), `lib/super-session.ts`
  (Super Admin + impersonation). This is *who is logged in and which academy they are*.
- **Tenant setup & isolation** — every record carries an `academyId`; the session
  supplies it. This is what keeps academies separate.
- **Billing / plans** — `lib/tiers.ts` defines the plan tiers and their limits;
  plan changes flow through the Super Admin.
- **Permissions** — `lib/permissions.ts` is the single role→action matrix.
- **Validation** — `lib/validation.ts` + `lib/schemas.ts`.
- **Cross-cutting infra** — `lib/rate-limit.ts`, `lib/http.ts`, `lib/logger.ts`,
  `lib/cookies.ts`, `lib/audit.ts`, `lib/prisma.ts`.

**Product-specific (feature) parts:**
- The **screens** in `components/academy-manager.tsx` (tenant app) and
  `components/super-admin.tsx` (console).
- The **feature endpoints** in `app/api/**` (students, classes, attendance, fees,
  reports, site, staff, settings…).
- The **data model** for each feature in `prisma/schema.prisma`.

**Rule of thumb:** a new *feature* almost always means new files under `app/api/` and
new UI in the relevant component, plus maybe a new table in `schema.prisma`. You
should rarely need to change the engine in `lib/` — and when you do, run the whole
test suite because it touches every tenant.

## How to add a brand-new feature or screen (step by step)

Say you want to add a **"Homework"** feature. The path is always the same:

1. **Model the data** — add a `Homework` model to `prisma/schema.prisma`. **Always
   include `academyId`** (and relate it to `Academy`) so it's tenant-isolated like
   everything else. Then create a migration:
   `npx prisma migrate dev --name add-homework`.
2. **Build the API** — create `app/api/homework/route.ts` (list/create) and
   `app/api/homework/[id]/route.ts` (get/update/delete). **Copy the pattern from an
   existing route** like `app/api/students/route.ts`: authenticate with the session,
   check permissions, validate input, and **always scope every query by the session's
   `academyId`** (never trust an academy ID from the request body).
3. **Add validation** — add a zod schema to `lib/schemas.ts` and use it in the route.
4. **Add UI** — add the screen/section in `components/academy-manager.tsx` (and a nav
   entry). Fetch from your new `/api/homework` endpoints.
5. **Permissions** — if only some roles may use it, add it to `lib/permissions.ts`.
6. **Test** — add a Vitest test (copy an existing one in `tests/`) that proves tenant
   isolation (Academy B cannot see Academy A's homework). Optionally an E2E in `e2e/`.
7. **Run the gates:** `npm run typecheck && npm run lint && npm test`.

For a **Super Admin** feature instead, the equivalent files are
`app/api/super-admin/**` and `components/super-admin.tsx`.

## Common client requests and roughly how you'd handle them

| Request | Effort | How you'd approach it |
|---------|--------|-----------------------|
| "Add a new field to students" (e.g. blood group) | **Quick** (½ day) | Add the column to `Student` in `schema.prisma` → migrate → add it to the student form + API validation in `academy-manager.tsx` and `app/api/students`. |
| "Change what a report shows" | **Quick–Medium** | Edit `lib/reports.ts` / `lib/pdf.ts` and the Reports screen. |
| "Add a new user role" or change what a role can do | **Medium** | Update `lib/permissions.ts` (the central matrix) and test every affected route. Engine-level — test thoroughly. |
| "Add a new plan tier / change limits" | **Medium** | Update `lib/tiers.ts` and the plan UI; check every place limits are enforced. |
| "Send parents a WhatsApp/SMS/email reminder" | **Real project** | New integration: add the provider + its API key (there's no messaging today), a sending service in `lib/`, triggers on invoice/attendance events, and opt-out handling. |
| "Let parents log in to a portal" | **Real project** | A new user type + auth surface + scoped read-only screens. Significant. |
| "Paginate/scale the big lists" | **Medium** | Backend paging already exists — wire the UI lists to the paged endpoints. |
| "Split the giant `academy-manager.tsx`" | **Medium, mechanical** | Extract each feature section into its own file under `components/`. No behaviour change; do it behind the tests. |

## Before you ship any change

Run the same gates CI runs: `npm run typecheck`, `npm run lint`, `npm test`,
`npm run build`, and (if UI/flows changed) `npm run test:e2e`. CI
(`.github/workflows/ci.yml`) runs these on every push — keep it green.

Deeper architecture notes live in the repo's `IMPLEMENTATION_REPORT.md` and
`NEXT_HARDENING_REPORT.md`.
