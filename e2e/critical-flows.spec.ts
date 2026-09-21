import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'

// Critical-flow E2E against a production build + real PostgreSQL. Uses the
// seeded demo tenants (see TEST_CREDENTIALS.md / prisma seeds).
const SUPER = { email: 'superadmin@academymanager.internal', password: 'SuperAdmin!2026' }
const SUNRISE = { email: 'owner@sunrise-learners.test', password: 'TenantA!2026' } // TRIAL
const RIVERSIDE = { email: 'owner@riverside-standard.test', password: 'TenantB!2026' } // BASIC
const DORMANT = { email: 'owner@dormant-gateway.test', password: 'TenantD!2026' } // INACTIVE
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000'

async function apiLogin(base: string, creds: { email: string; password: string }): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base })
  const res = await ctx.post('/api/auth/login', { data: creds })
  expect(res.status(), `login ${creds.email}`).toBe(200)
  return ctx
}

test.describe('Authentication (UI)', () => {
  test('rejects invalid credentials and accepts valid ones, then logs out', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('owner@brightfuture.test').fill(SUNRISE.email)
    await page.getByPlaceholder('Enter your password').fill('wrong-password')
    await page.getByRole('button', { name: /sign in/i }).click()
    // Stays on the login screen (error shown, no dashboard).
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()

    await page.getByPlaceholder('owner@brightfuture.test').fill(SUNRISE.email)
    await page.getByPlaceholder('Enter your password').fill(SUNRISE.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    // Reaches the authenticated app (login form gone).
    await expect(page.getByPlaceholder('Enter your password')).toBeHidden({ timeout: 15_000 })
  })
})

test.describe('Security boundaries (API within a real browser context)', () => {
  test('unauthenticated requests are rejected', async () => {
    const ctx = await pwRequest.newContext({ baseURL: BASE })
    expect((await ctx.get('/api/dashboard')).status()).toBe(401)
    expect((await ctx.get('/api/students')).status()).toBe(401)
    await ctx.dispose()
  })

  test('a tenant session cannot reach Super-Admin routes', async () => {
    const a = await apiLogin(BASE, SUNRISE)
    expect((await a.get('/api/super-admin/dashboard')).status()).toBe(401)
    expect((await a.get('/api/super-admin/tenants')).status()).toBe(401)
    await a.dispose()
  })

  test('cross-tenant IDOR is blocked (A cannot read B\'s student)', async () => {
    const b = await apiLogin(BASE, RIVERSIDE)
    const list = await (await b.get('/api/students')).json()
    const victimId = (list.students ?? list)[0].id
    await b.dispose()

    const a = await apiLogin(BASE, SUNRISE)
    expect((await a.get(`/api/students/${victimId}`)).status()).toBe(404)
    await a.dispose()
  })

  test('plan entitlement enforced: TRIAL has no reports, BASIC does', async () => {
    const trial = await apiLogin(BASE, SUNRISE)
    expect((await trial.get('/api/reports?type=fees&period=month')).status()).toBe(403)
    await trial.dispose()
    const basic = await apiLogin(BASE, RIVERSIDE)
    expect((await basic.get('/api/reports?type=fees&period=month')).status()).toBe(200)
    await basic.dispose()
  })

  test('malformed and invalid input is rejected with 400', async () => {
    const b = await apiLogin(BASE, RIVERSIDE)
    // Malformed JSON.
    const bad = await b.post('/api/payments', { headers: { 'content-type': 'application/json' }, data: '{not json' })
    expect(bad.status()).toBe(400)
    // Schema violation (negative amount).
    const neg = await b.post('/api/payments', { data: { invoiceId: '11111111-1111-4111-8111-111111111111', amount: -1, paymentMethod: 'CASH' } })
    expect(neg.status()).toBe(400)
    await b.dispose()
  })
})

test.describe('Super Admin impersonation lifecycle (API)', () => {
  test('inactive tenant is reachable only via a valid Super Admin context, and exit revokes it', async () => {
    // Normal login for an INACTIVE tenant is blocked.
    const ctx = await pwRequest.newContext({ baseURL: BASE })
    expect((await ctx.post('/api/auth/login', { data: DORMANT })).status()).toBe(403)

    // Super Admin logs in and impersonates the inactive tenant.
    const sa = await pwRequest.newContext({ baseURL: BASE })
    expect((await sa.post('/api/super-admin/auth/login', { data: SUPER })).status()).toBe(200)
    const tenants = await (await sa.get('/api/super-admin/tenants')).json()
    const dormant = (tenants.tenants ?? tenants).find((t: { slug?: string; name?: string }) => (t.slug ?? '').includes('dormant') || (t.name ?? '').includes('Dormant'))
    expect(dormant, 'dormant tenant present').toBeTruthy()
    expect((await sa.post(`/api/super-admin/tenants/${dormant.id}/impersonate`)).status()).toBe(200)
    // Now the inactive tenant's data is reachable.
    expect((await sa.get('/api/students')).status()).toBe(200)
    // Clean exit ends the privileged session.
    expect((await sa.post('/api/super-admin/impersonation/exit')).status()).toBe(200)
    expect((await sa.get('/api/students')).status()).toBe(401)
    await sa.dispose()
    await ctx.dispose()
  })

  test('an INACTIVE tenant is read-only under impersonation: reads OK, writes 403', async () => {
    const sa = await pwRequest.newContext({ baseURL: BASE })
    expect((await sa.post('/api/super-admin/auth/login', { data: SUPER })).status()).toBe(200)
    const tenants = await (await sa.get('/api/super-admin/tenants')).json()
    const dormant = (tenants.tenants ?? tenants).find((t: { slug?: string; name?: string }) => (t.slug ?? '').includes('dormant') || (t.name ?? '').includes('Dormant'))
    expect(dormant).toBeTruthy()
    expect((await sa.post(`/api/super-admin/tenants/${dormant.id}/impersonate`)).status()).toBe(200)

    // Inspection (reads) is allowed.
    expect((await sa.get('/api/dashboard')).status()).toBe(200)
    expect((await sa.get('/api/students')).status()).toBe(200)

    // Any write is rejected while the tenant is inactive — the tenant is frozen.
    const cls = (await (await sa.get('/api/classes')).json()).classes?.[0]
    const addStudent = await sa.post('/api/students', {
      data: { fullName: 'Frozen', parentName: 'P', parentPhone: '0300-1234567', classId: cls?.id ?? '00000000-0000-4000-8000-000000000000', monthlyFee: 1000 },
    })
    expect(addStudent.status()).toBe(403)
    const addPayment = await sa.post('/api/payments', { data: { studentId: '00000000-0000-4000-8000-000000000000', month: '2026-09', amount: 100, paymentMethod: 'CASH' } })
    expect(addPayment.status()).toBe(403)

    await sa.post('/api/super-admin/impersonation/exit')
    await sa.dispose()
  })
})
