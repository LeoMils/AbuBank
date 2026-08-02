/**
 * GATE 7 — ACTION BUTTON REACHABILITY (not just DOM presence).
 *
 * Upgrades "the button exists" to "the button is genuinely reachable": its centre
 * is the TOP element at that point (document.elementFromPoint — not obscured by an
 * overlay), its bounding box is fully inside the usable viewport, it is enabled
 * and >= 44x44, at three real iPhone viewports AND with the composer/textarea
 * focused. Providers are blocked so the deterministic engine renders the card.
 */
import { test, expect, type Page } from '@playwright/test'

async function seedAndOpenAbuAI(page: Page, vw: number, vh: number) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('abubank.familyContacts.v1', JSON.stringify({
        v: 2, contacts: [{ id: 'mor', displayName: 'מור', enabled: true, phoneE164: '+972500000001' }],
      }))
    } catch { /* ignore */ }
  })
  await page.route(/\/api\/abuai-chat/, (r) => r.abort())
  await page.route(/generativelanguage\.googleapis\.com/, (r) => r.abort())
  await page.route(/api\.groq\.com/, (r) => r.abort())
  await page.setViewportSize({ width: vw, height: vh })
  await page.goto('/', { waitUntil: 'networkidle', timeout: 45_000 })
  await page.locator('text=Abu AI').first().click()
  await page.locator('textarea[placeholder]').first().waitFor({ state: 'visible', timeout: 10_000 })
}

async function assertReachable(page: Page, vw: number, vh: number, label: string) {
  const btn = page.getByTestId('communication-primary-action')
  await btn.waitFor({ state: 'visible', timeout: 20_000 })
  await expect(btn, `${label}: enabled`).toBeEnabled()
  const box = await btn.boundingBox()
  expect(box, `${label}: has layout box`).not.toBeNull()
  // Fully inside the usable viewport.
  expect(box!.y, `${label}: top on-screen`).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height, `${label}: bottom on-screen`).toBeLessThanOrEqual(vh)
  expect(box!.x, `${label}: left on-screen`).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width, `${label}: right on-screen`).toBeLessThanOrEqual(vw)
  expect(box!.height, `${label}: >=44px tall`).toBeGreaterThanOrEqual(44)
  expect(box!.width, `${label}: >=44px wide`).toBeGreaterThanOrEqual(44)
  // NOT OBSCURED: the button (or a descendant) is the top element at its centre.
  const cx = box!.x + box!.width / 2, cy = box!.y + box!.height / 2
  const topIsButton = await page.evaluate(({ cx, cy }) => {
    const el = document.elementFromPoint(cx, cy)
    const btn = document.querySelector('[data-testid="communication-primary-action"]')
    if (!el || !btn) return false
    return el === btn || btn.contains(el) || (el as HTMLElement).closest('[data-testid="communication-primary-action"]') === btn
  }, { cx, cy })
  expect(topIsButton, `${label}: centre not obscured (elementFromPoint hits the button)`).toBe(true)
}

for (const vp of [{ w: 375, h: 667, n: 'iPhone SE' }, { w: 390, h: 844, n: 'iPhone 13' }, { w: 430, h: 932, n: 'iPhone 15 Pro Max' }]) {
  test(`(reachable) Call action not obscured @ ${vp.n}`, async ({ page }) => {
    await seedAndOpenAbuAI(page, vp.w, vp.h)
    const ta = page.locator('textarea[placeholder]').first()
    await ta.fill('תתקשרי למור'); await ta.press('Enter')
    await assertReachable(page, vp.w, vp.h, vp.n)
  })
}

test('(reachable) Call action reachable with the composer focused (keyboard-present proxy)', async ({ page }) => {
  await seedAndOpenAbuAI(page, 390, 844)
  const ta = page.locator('textarea[placeholder]').first()
  await ta.fill('תתקשרי למור'); await ta.press('Enter')
  await page.getByTestId('communication-primary-action').waitFor({ state: 'visible', timeout: 20_000 })
  await ta.focus() // keep the composer focused (soft keyboard is not emulable headless)
  await assertReachable(page, 390, 844, 'composer-focused')
})
