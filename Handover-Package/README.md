# Academy Manager — Developer Handover Package

This folder is the complete handover for **Academy Manager**, a multi-tenant SaaS
for tuition centres / academies. It is organised to match every item in the
*"Handover Package — What I Need From Each of You"* requirements document.

> **Product in one line:** one platform that lets many separate academies each run
> their students, classes, attendance, fees, staff, reports, and a public website —
> while a central **Super Admin** manages every academy (tenant) from one console.

---

## How this package maps to the requirements

| # | Requirement | Where to find it |
|---|-------------|------------------|
| 1 | Code Walkthrough | [`01-Code-Walkthrough.md`](01-Code-Walkthrough.md) |
| 2 | Complete Flow Documentation | [`02-Complete-Flow.md`](02-Complete-Flow.md) |
| 3 | Deployment Instructions | [`03-Deployment-Instructions.md`](03-Deployment-Instructions.md) + [`example.env`](example.env) |
| 4 | QA/QC — How to Test It | [`04-QA-Testing-Checklist.md`](04-QA-Testing-Checklist.md) |
| 5 | Client Training Materials | [`05-Client-Training-Guide.md`](05-Client-Training-Guide.md) |
| 6 | Demonstration Script | [`06-Demonstration-Script.md`](06-Demonstration-Script.md) |
| 7 | After-Sales Support Guide | [`07-After-Sales-Support.md`](07-After-Sales-Support.md) |
| 8 | Future Development Guide | [`08-Future-Development-Guide.md`](08-Future-Development-Guide.md) |
| — | **Video** recording scripts (the two required videos) | [`09-Video-Recording-Scripts.md`](09-Video-Recording-Scripts.md) |
| — | **All login credentials** (one file per account) | [`credentials/`](credentials/) |

## What is included vs. what you must still do yourself

**Included (written, ready to use):** every written deliverable in the
requirements — folder-structure explanation, full customer-journey flow,
first-timer deployment steps, the account/API-key list, an annotated env file,
the exact commands, the QA checklist, known bugs, data-reset instructions, a
client onboarding guide, a demo script, an after-sales support guide, a
future-development guide, and a login-credentials file for **every** account.

**You must still record yourself (cannot be generated):**
- The **15–20 min code-walkthrough video** (§1) — a word-for-word script is in
  [`09-Video-Recording-Scripts.md`](09-Video-Recording-Scripts.md).
- The **5–10 min client-training video** (§5) — script also in that file.
- **Screenshots of every screen** (§2, §5) — a complete, labelled shot list is in
  [`02-Complete-Flow.md`](02-Complete-Flow.md#screenshot-shot-list). Capture them
  while running the demo script; each screen is already named for you.

## Fastest way to see the product running

```bash
npm install
cp .env.example .env
npm run db:pg:start
npx prisma migrate deploy
npm run prisma:seed
npm run seed:super-admin
npm run dev        # http://localhost:3000
```
Then log in with any account from [`credentials/`](credentials/). Full detail in
[`03-Deployment-Instructions.md`](03-Deployment-Instructions.md).

---
*Generated 2026-09-25. Source of truth for deeper technical detail: the repo's own
`HANDOVER.md`, `DEPLOY.md`, and `NEXT_HARDENING_REPORT.md`.*
