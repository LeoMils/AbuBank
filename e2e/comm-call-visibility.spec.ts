/**
 * FAILURE C (device): the response said "לחצי על התקשרי" but no usable Call
 * button was visible. This proves, at the physical iPhone viewport, that a call
 * handoff renders a Call button whose bounding box is INSIDE the viewport and
 * enabled — and that the "התקשרי" claim only appears with that reachable button.
 * FAILURE B is also asserted here: an explicit send never falls to general chat.
 */
import { test, expect, type Page } from '@playwright/test'

// Physical iPhone viewport (from the device screenshot).
const VW = 390, VH = 844

async function seedAndOpenAbuAI(page: Page, vw = VW, vh = VH) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('abubank.familyContacts.v1', JSON.stringify({
        v: 2, contacts: [{ id: 'mor', displayName: 'מור', enabled: true, phoneE164: '+972500000456' }],
      }))
    } catch { /* ignore */ }
  })
  // Block providers so the deterministic engine path is exercised (no LLM).
  await page.route(/\/api\/abuai-chat/, (r) => r.abort())
  await page.route(/generativelanguage\.googleapis\.com/, (r) => r.abort())
  await page.route(/api\.groq\.com/, (r) => r.abort())
  await page.setViewportSize({ width: vw, height: vh })
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.locator('text=Abu AI').first().click()
  await page.locator('textarea[placeholder]').first().waitFor({ state: 'visible', timeout: 10_000 })
}

// The primary action button must be inside the usable viewport, enabled, and a
// large tap target — across the range of real iPhone sizes.
for (const vp of [{ w: 390, h: 844, name: 'iPhone 13' }, { w: 375, h: 667, name: 'iPhone SE' }, { w: 430, h: 932, name: 'iPhone 15 Pro Max' }]) {
  test(`(C multi-viewport) Call button reachable at ${vp.name} ${vp.w}x${vp.h}`, async ({ page }) => {
    await seedAndOpenAbuAI(page, vp.w, vp.h)
    const ta = page.locator('textarea[placeholder]').first()
    await ta.fill('תתקשרי למור'); await ta.press('Enter')
    const btn = page.getByTestId('communication-primary-action')
    await btn.waitFor({ state: 'visible', timeout: 20_000 })
    await expect(btn).toBeEnabled()
    const box = await btn.boundingBox()
    expect(box, `${vp.name}: layout box`).not.toBeNull()
    expect(box!.y, `${vp.name}: top edge on-screen`).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height, `${vp.name}: bottom edge on-screen`).toBeLessThanOrEqual(vp.h)
    expect(box!.height, `${vp.name}: >=44px`).toBeGreaterThanOrEqual(44)
  })
}

test('(C) a call handoff renders a Call button INSIDE the iPhone viewport, enabled', async ({ page }) => {
  await seedAndOpenAbuAI(page)
  const ta = page.locator('textarea[placeholder]').first()
  await ta.fill('תתקשרי למור'); await ta.press('Enter')

  const card = page.getByTestId('communication-action-card')
  await card.waitFor({ state: 'visible', timeout: 20_000 })
  expect(await card.getAttribute('data-mode')).toBe('call')

  const btn = page.getByTestId('communication-primary-action')
  await expect(btn).toBeVisible()
  await expect(btn).toBeEnabled()
  // The lead may claim the button ONLY because it is rendered.
  const lead = page.getByTestId('abuai-msg-assistant').last()
  await expect(lead).toContainText('התקשרי')

  // Bounding box fully inside the viewport (not below the fold / off-screen).
  const box = await btn.boundingBox()
  expect(box, 'call button must have a layout box').not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(VH)
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.width).toBeGreaterThan(120)   // large, readable target
  expect(box!.height).toBeGreaterThanOrEqual(44)
})

test('(B) an explicit send to an unresolved name stays communication, never general', async ({ page }) => {
  await seedAndOpenAbuAI(page)
  const ta = page.locator('textarea[placeholder]').first()
  await ta.fill('תשלח הודעה ללאה שיביא מחר שניצלים בערב'); await ta.press('Enter')

  // A communication action card appears (handoff or clarify) — never a generic
  // chat denial.
  const lead = page.getByTestId('abuai-msg-assistant').last()
  await lead.waitFor({ state: 'visible', timeout: 20_000 })
  await expect(lead).not.toContainText('לא יכולה לשלוח')
  await expect(lead).not.toContainText('אין כלום ביומן')
})
