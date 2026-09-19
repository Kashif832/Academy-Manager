import { test, expect } from '@playwright/test'

// Regression guard: the nonce-based CSP (proxy.ts) must not block the app's own
// scripts. Collect any CSP violation console errors on a fresh load + hydration
// and assert there are none, and that the login UI is interactive.
test('nonce CSP does not block the app on a fresh load', async ({ page }) => {
  const cspErrors: string[] = []
  page.on('console', (msg) => {
    const t = msg.text()
    if (msg.type() === 'error' && /Content Security Policy|violates the following/i.test(t)) cspErrors.push(t)
  })

  await page.goto('/', { waitUntil: 'networkidle' })
  // Prove hydration: the password toggle/input works and the form is usable.
  await page.getByPlaceholder('Enter your password').fill('probe')
  await expect(page.getByPlaceholder('Enter your password')).toHaveValue('probe')

  expect(cspErrors, cspErrors.join('\n')).toEqual([])

  // The response carries a per-request script nonce.
  const res = await page.request.get('/')
  const csp = res.headers()['content-security-policy'] || ''
  expect(csp).toMatch(/script-src[^;]*'nonce-/)
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
})
