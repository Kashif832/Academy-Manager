# 7. After-Sales Support Guide

How to handle the problems a real client is most likely to report.

## Most likely client problems → how to fix

| Client says… | Most likely cause | How to fix |
|--------------|-------------------|------------|
| "I can't log in / it says *Could not reach the server*" | The app or database isn't running/reachable (locally: PostgreSQL stopped). | Check the app is up: `/api/health` and `/api/health/ready`. Locally run `npm run db:pg:start`. The "reach the server" message often means the DB is down, not the web server. |
| "I type the right password but nothing happens / it kicks me back to login" | Cookie not being set because the site isn't truly HTTPS (the `Secure` cookie is dropped over plain HTTP). | Ensure it's served over **HTTPS** and your proxy forwards `x-forwarded-proto=https`. If TLS terminates elsewhere, set `COOKIE_SECURE=true`. |
| "Too many attempts, try again later" | Rate limit hit (5 logins/min) after repeated wrong passwords. | Wait 60 seconds and retry. It's a brute-force protection, working as intended. |
| "A staff member forgot their password" | — | Owner: **Settings → Staff** → reset. Or the Super Admin can help via impersonation. |
| "The owner is locked out entirely" | Forgot password, no one to reset. | Super Admin can impersonate the academy and reset the owner from Staff/Settings. |
| "Our whole academy is read-only / we can't save anything" | The tenant is **deactivated** (frozen). | Super Admin → edit that tenant → **Reactivate**. Writes resume immediately. |
| "A payment was recorded by mistake" | — | Open the invoice → **void/refund** the payment. It's corrected; history is preserved (never deleted). |
| "Our public website shows old content" | Edits not saved, or browser cache. | Re-save under **Website**; hard-refresh the public page. |
| "I upgraded but still have the old limits" | The plan-upgrade **request** hasn't been approved yet. | Super Admin → **Plan requests** → approve it. |
| "It's slow with lots of students" | Very large lists render fully in the UI (known limitation). | Fine to ~1,500 students/instance. Beyond that, escalate to dev (wire UI to paged endpoints / add an instance + Redis). |

## Who to contact for which kind of issue

> Fill in the real names/contacts for your team. Template:

| Issue type | First contact |
|------------|---------------|
| Deployment / server down / HTTPS / database | **[DevOps / lead developer — name, email, phone]** |
| Login, tenants, impersonation, plans (platform behaviour) | **[Product owner / platform admin]** |
| Fees / reports / data questions (how a feature works) | **[Support lead]** |
| A suspected bug or data corruption | **[Lead developer]** — include the request ID from logs (see below) |

## Where to look when something seems broken

1. **Health first:** `GET /api/health` (app alive?) and `/api/health/ready` (database
   up? returns 503 if the DB is down).
2. **Application logs:** structured JSON logs (secrets are auto-redacted). Every error
   has a **request ID** — ask the client roughly when it happened and search the logs
   for 5xx errors around that time. Include the request ID when escalating.
3. **What to check, in order:**
   - Is it **all** users or **one** academy? One academy → check if it's deactivated.
   - Is it login-related → HTTPS/cookie issue (see table).
   - Is it "server unreachable" → database health (`/api/health/ready`).
   - Is it "too many attempts" → rate limit, just wait.
4. **Audit log:** the Super Admin console and each tenant's Settings have an **audit
   log** of sensitive actions (who did what, when) — useful for "who changed this?"
5. **Database:** the data itself lives in PostgreSQL; take a backup (`npm run db:backup`)
   before any manual investigation or fix.

## Golden rules for support

- **Always back up the database before any fix that touches data.**
- Prefer **void/refund** over deleting anything financial.
- Reactivating a frozen tenant is safe and instant — no data is lost when a tenant is
  deactivated; it's only frozen.
