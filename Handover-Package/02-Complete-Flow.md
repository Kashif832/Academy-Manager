# 2. Complete Flow Documentation

This is the **actual** customer journey as built, for all three types of user.

---

## A. Academy (tenant) staff journey — the core product

This is what a paying academy does day to day.

1. **Account creation (done for them).** Academies are *not* self-signup. The
   platform **Super Admin creates the academy** and its first **Owner** account
   (name, email, initial password, plan tier). The owner is handed those
   credentials. *(See §B for the Super Admin side.)*
2. **First login.** Owner goes to the app root `/`, enters email + password.
   Session cookie is set; they land on the **Dashboard**.
3. **Dashboard.** At-a-glance figures: total students, fees collected this month,
   outstanding/overdue fees, attendance summary, recent activity.
4. **Set up classes.** *Classes* screen → add classes (name, section, monthly fee,
   assigned teacher).
5. **Add staff (optional).** *Staff* screen → invite ADMIN or TEACHER users. Roles
   decide what each can do (owner sees everything; teacher is limited).
6. **Add students.** *Students* screen → add each student (name, parent name/phone,
   class, monthly fee, admission date). Creating a student can generate their first
   monthly fee invoice.
7. **Daily use — attendance.** *Attendance* screen → pick a class + date → mark each
   student Present/Absent/Late. Saved per day.
8. **Daily use — fees / billing.** *Fees* screen → see each student's invoice status
   (Paid / Pending / Partial / Overdue) → record a payment (cash/other) → a **receipt**
   is generated (PDF). Payments can be **voided/refunded** (never deleted).
9. **Reports.** *Reports* screen → collection summaries, outstanding dues,
   attendance — exportable to **PDF**.
10. **Public website (CMS).** *Website* screen → edit the academy's public page
    content (about, contact, posts) that appears at `/site/<academy-slug>`.
11. **Admissions CRM.** Inquiries submitted from the public site land in
    *Admissions/Inquiries* → staff review and follow up.
12. **Settings.** Profile, change password, staff management, plan/subscription
    (request an upgrade — the Super Admin approves it), data export, audit log.
13. **Logout.** Ends the session.

> **Billing note (important, as actually built):** the app does **not** charge
> credit cards itself. Plan tier is set/changed administratively. An academy
> *requests* a plan upgrade from Settings; the **Super Admin reviews and approves**
> it. There is no live payment-gateway integration — see §3 "Accounts & keys".

## B. Platform Super Admin journey — managing all academies

1. **Login** at `/super-admin/login` (separate from tenant login).
2. **Dashboard** — every academy (tenant): plan tier, status, counts; plus
   pending plan-upgrade requests and the platform audit log.
3. **Create a tenant** — name, owner name/email/initial password, plan tier. This is
   how a new paying academy is onboarded.
4. **Edit a tenant** — rename, change plan tier, **activate / deactivate**.
   Deactivating **freezes** the academy: its users can't log in and it becomes
   read-only even under impersonation.
5. **Manage / impersonate a tenant** — securely "enter" an academy to see and
   operate exactly what they see (to reproduce an issue or help). A banner shows you
   are impersonating; **Exit** returns you to the console.
6. **Review plan requests** — approve/reject an academy's upgrade request, with a note.
7. **Logout**.

## C. Public visitor / parent journey

1. Visit `/site/<academy-slug>` — the academy's public website.
2. Read about the academy, its posts/announcements.
3. **Submit an admission inquiry** (name, contact, message) → appears in that
   academy's Admissions inbox.
4. **Fee lookup** (if enabled) — a parent can look up an invoice status.

---

## Screenshot shot list

> **You must capture these** (requirement §2 and §5). Run the
> [demo script](06-Demonstration-Script.md) and screenshot each screen below.
> Save them into a `screenshots/` folder next to this file and label each with the
> name given here. This list *is* the "every screen, labelled" deliverable.

**Tenant app** (logged in as `owner@brightfuture.test`):
- `01-tenant-login` — the tenant login screen
- `02-dashboard` — main dashboard with stats
- `03-students-list` — students table
- `04-student-add` — add/edit student form
- `05-classes` — classes list + add class
- `06-attendance` — attendance marking for a class/date
- `07-fees-overview` — fees/invoices with statuses
- `08-record-payment` — record-payment dialog
- `09-receipt-pdf` — a generated receipt
- `10-reports` — reports screen (+ a PDF export)
- `11-website-cms` — public-website editor
- `12-admissions-inquiries` — inquiries inbox
- `13-settings` — settings (profile / plan / staff / audit log)

**Public site** (logged out):
- `14-public-site` — `/site/bright-future`
- `15-inquiry-form` — the admission inquiry form

**Super Admin** (logged in as `superadmin@academymanager.internal`):
- `16-superadmin-login` — `/super-admin/login`
- `17-superadmin-dashboard` — all tenants list
- `18-create-tenant` — create-tenant form
- `19-edit-tenant` — edit/deactivate tenant
- `20-impersonation-banner` — impersonating a tenant (read-only banner if inactive)
- `21-plan-requests` — plan-upgrade review screen

*(Screenshots are the one part of this section that must be captured from the
running app — everything else above reflects the built behaviour.)*
