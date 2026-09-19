import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Automated WCAG 2.1 A/AA accessibility scans of key public/entry pages.
// Fails on any critical or serious violation; logs all findings for review.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function scan(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  if (results.violations.length) {
    console.log(
      'axe violations:',
      results.violations.map((v) => `${v.impact}:${v.id}(${v.nodes.length})`).join(', '),
    )
  }
  return blocking
}

test('tenant login page has no critical/serious a11y violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /sign in/i }).waitFor()
  const blocking = await scan(page)
  expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([])
})

test('super admin login page has no critical/serious a11y violations', async ({ page }) => {
  await page.goto('/super-admin/login')
  await page.getByRole('button', { name: /sign in/i }).waitFor()
  const blocking = await scan(page)
  expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([])
})

test('public academy website has no critical/serious a11y violations', async ({ page }) => {
  await page.goto('/site/crescent-premium')
  await page.waitForLoadState('networkidle')
  const blocking = await scan(page)
  expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([])
})
