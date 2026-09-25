# Video Recording Scripts

Two videos are required by the handover. They can't be generated — **you record
them** — but here are word-for-word scripts so each takes ~20 minutes, not hours.
Record with any screen recorder (Loom, OBS, or Windows **Win+G** Game Bar) and share
the file via Google Drive. Clarity beats polish.

---

## Video 1 — Code Walkthrough (15–20 min) {#video-1}

*Open the project in your editor. Talk like you're explaining to a smart friend who
doesn't code. Follow this order:*

1. **(1 min) What it is.** "This is Academy Manager — one app that lets many separate
   academies each manage students, fees, attendance, and their own website, while we
   run all of them from a Super Admin console."
2. **(2 min) The folders.** Open `Handover-Package/01-Code-Walkthrough.md` and read the
   folder tree on screen: `app/` = the URLs, `app/api/` = the back-end, `components/`
   = the screens, `lib/` = the shared brain, `prisma/` = the database structure.
3. **(3 min) Follow one request.** Open `components/academy-manager.tsx`, find where it
   calls `/api/students`. Then open `app/api/students/route.ts`. Walk through:
   authenticate (`lib/session.ts`) → the academy ID comes from the *session*, not the
   browser → check permissions → validate → `prisma.student.create`. Stress: "the
   server decides which academy you are — that's how academies stay isolated."
4. **(3 min) The database.** Open `prisma/schema.prisma`. Show a few models (Academy,
   User, Student, Class, FeeInvoice). Point out that almost everything has an
   `academyId` — "that column is what walls each academy off from the others."
5. **(3 min) The tricky bits.** Open and explain briefly:
   - `lib/super-session.ts` — impersonation (a separate server session, not a borrowed
     login; ending it cuts access next request).
   - `app/api/payments/route.ts` — money: transactions + never deleting history.
   - `lib/cookies.ts` — the Secure-cookie/HTTPS gotcha.
6. **(2 min) The Super Admin side.** Open `components/super-admin.tsx` and
   `app/api/super-admin/**` — "same patterns, but for managing all tenants."
7. **(2 min) How it's proven.** Open `tests/` and `e2e/` — "these run automatically on
   every push via `.github/workflows/ci.yml`; the important one proves Academy B can't
   see Academy A's data."
8. **(1 min) Where to read more.** Point at `HANDOVER.md`, `DEPLOY.md`, and this
   `Handover-Package/` folder.

---

## Video 2 — Client Training (5–10 min) {#video-2}

*Log in to the app as the demo account `owner@brightfuture.test` / `password123`.
Speak as if teaching a brand-new academy owner. Screen-record the whole thing.*

1. **(30s) Logging in.** "Go to your web address, enter the email and password we gave
   you, click Sign in. First time — change your password in Settings."
2. **(1 min) The Dashboard.** "This is your home screen — students, fees collected,
   what's outstanding, attendance."
3. **(1 min) Add a class.** Classes → Add class → name, section, fee, teacher → Save.
4. **(1.5 min) Add a student.** Students → Add student → name, parent details, class,
   fee → Save. "There they are, with their first invoice ready."
5. **(1.5 min) Mark attendance.** Attendance → pick the class and today → tap
   Present/Absent → Save.
6. **(1.5 min) Record a fee.** Fees → pick a pending invoice → Record payment → amount
   → Save → show the receipt. "And you can void or refund if you make a mistake."
7. **(1 min) A report.** Reports → Export PDF. "For your records or a meeting."
8. **(30s) Wrap up.** "That's the daily loop: students, attendance, fees, reports. If
   anything looks wrong, contact us — we can help you securely from our side."

*Tip: if you re-record several times and login starts failing, wait 60 seconds — that's
the anti-brute-force limit, not a bug.*
