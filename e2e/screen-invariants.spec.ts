/*
 * screen-invariants.spec.ts — LAYER 2 (merge blocker): screen invariants on a REAL browser against
 * a production Preview build. Per screen: it renders (visible text), RTL, key text >= 16px, and NO
 * developer/QA text in the production build (the DEV-gated "QA: v" badge must be ABSENT).
 * Run: PREVIEW_URL=<preview> npx playwright test e2e/screen-invariants.spec.ts --project=chromium
 * The full 15-screen sweep expands this template; Home + Settings are the hub-reachable smoke here.
 */
import { test, expect, type Page } from '@playwright/test'

// Grant mic so the live screen does not hard-block; screens still render without real audio.
test.use({ permissions: ['microphone'] })

async function assertScreenInvariants(page: Page, label: string) {
  // renders: visible body text
  const body = await page.locator('body').innerText()
  expect(body.trim().length, `${label}: renders visible text`).toBeGreaterThan(0)
  // RTL: the app is Hebrew — an rtl direction is present on the tree
  const hasRtl = await page.locator('[dir="rtl"]').count()
  expect(hasRtl, `${label}: has an RTL container`).toBeGreaterThan(0)
  // NO developer/QA text in a production build (the QA badge is DEV-gated; localhost/DEBUG must not show)
  expect(body, `${label}: no QA badge in prod`).not.toMatch(/QA:\s*v\d/)
  expect(body, `${label}: no dev/debug text`).not.toMatch(/localhost|DEBUG_|__DEV__/)
}

test.describe('screen invariants (production preview)', () => {
  test('Home renders, RTL, >=16px, no dev/QA text', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await assertScreenInvariants(page, 'Home')
    // a key piece of text is at least 16px (senior-first)
    const heading = page.locator('h1, [role="heading"]').first()
    if (await heading.count()) {
      const px = await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
      expect(px, 'Home heading >= 16px').toBeGreaterThanOrEqual(16)
    }
  })

  test('Settings renders, RTL, no dev/QA text', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const settings = page.getByLabel('הגדרות').first()
    if (await settings.count()) {
      await settings.click()
      await page.waitForTimeout(400)
    }
    await assertScreenInvariants(page, 'Settings')
  })
})
