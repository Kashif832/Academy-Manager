# 6. Demonstration Script

A follow-along script to demo Academy Manager to a **prospect** or the **CEO**.
Total time ~10 minutes. Everything is preloaded — no setup mid-demo.

**Before you start:**
- Make sure the app is running and seeded (see §3 / §4 reset steps).
- Keep this **always-ready demo account** open in one tab:
  `owner@brightfuture.test` / `password123` (Bright Future Academy — full sample data).
- Keep the Super Admin open in another tab: `superadmin@academymanager.internal`
  (password in [`credentials/00-super-admin.md`](credentials/00-super-admin.md)).

---

## Part 1 — "This is what an academy gets" (6 min)

1. **Log in.** *"Every academy gets their own private, secure space. Here's a
   fully-loaded example academy."* → land on the Dashboard.
2. **Dashboard.** *"At a glance: how many students, fees collected this month,
   what's outstanding, attendance."* Point at each number.
3. **Students.** Open Students. *"Every student, their parent's contact, their class
   and their fee."* Click **Add student**, fill it in, save. *"Instantly added."*
4. **Attendance.** Open Attendance, pick a class + today. Mark a couple Present/Absent.
   Save. *"Daily attendance in seconds — and it feeds the dashboard."*
5. **Fees — the money story.** Open Fees. *"Here's who's paid, pending, or overdue."*
   Pick a Pending invoice → **Record payment** → save → show the **receipt**.
   *"A receipt is generated automatically. And if we make a mistake—"* void/refund it
   *"—the record is corrected but nothing is ever deleted. That matters for money."*
6. **Reports.** Open Reports → **Export PDF**. *"One click for a collection or dues
   report to take into a meeting."*
7. **Public website.** Open Website, tweak a line, save, then open
   `/site/bright-future`. *"Each academy also gets a public page where parents can
   read about them and send an admission inquiry — which lands right back in the
   academy's inbox."* Show the inquiry form.

## Part 2 — "And this is how YOU run the whole platform" (3 min)

Switch to the Super Admin tab.
8. **Super Admin dashboard.** *"From here we manage every academy on the platform —
   their plan, their status, everything — from one screen."*
9. **Create a tenant.** Click **Create tenant**, fill it in. *"Onboarding a new
   paying academy takes under a minute — name, owner, plan tier, done."*
10. **Plan upgrade.** Show the plan-requests screen. *"When an academy wants to
    upgrade, they request it and we approve it here."*
11. **The trust bit — deactivate + impersonate.** Deactivate a demo academy. *"If an
    account lapses, we freeze it — it becomes read-only instantly."* Then impersonate
    it. *"We can securely step into any academy to support them — with a clear banner,
    and on a frozen account we can look but not change anything."* **Exit**.

## Closing line

*"So: every academy gets a complete, private management system and a public web
presence — and we run the entire platform, onboard new academies, and support them,
all from one console. It's multi-tenant, secure by design, and ready to grow."*

---

## The always-ready demo account

- **Academy:** Bright Future Academy — `owner@brightfuture.test` / `password123`
- Preloaded with 4 classes, 4 students (Paid / Pending / Overdue mix), invoices,
  a payment + receipt, and attendance — so every screen has something real to show
  **without any setup**.
- To reset it to a pristine state before an important demo, see
  [§4 Part 4](04-QA-Testing-Checklist.md#part-4--reset-data--create-fresh-sample-data-for-a-clean-demo).
