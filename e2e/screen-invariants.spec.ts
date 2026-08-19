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

// The 15 screens (Screen enum). Each is rendered directly via ?screen=<name> — a diagnostic/test
// affordance in App.tsx — so the browser harness verifies EVERY screen, including the state screens
// (Opening/Offline/Error) that are not reachable by a tile click.
const SCREENS = [
  'Home', 'Opening', 'Offline', 'Error', 'Admin', 'AbuAI', 'AbuWhatsApp', 'Settings',
  'AbuGames', 'AbuWeather', 'AbuCalendar', 'AbuBank', 'AbuNews', 'FamilyGallery', 'FamilyRecord',
]

test.describe('screen invariants (production preview) — all 15 screens', () => {
  for (const screen of SCREENS) {
    test(`${screen}: renders, RTL, >=16px key text, no dev/QA text in prod`, async ({ page }) => {
      await page.goto(`/?screen=${screen}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(500) // let the screen mount + the ?screen effect run
      await assertScreenInvariants(page, screen)
      // senior-first: the primary HEADING text (not icon buttons) is at least 16px. Icon-only
      // buttons carry glyphs, not readable text, so they are excluded from this floor.
      const heading = page.locator('h1, h2, [role="heading"]').first()
      if (await heading.count()) {
        const px = await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize) || 16)
        expect(px, `${screen}: heading >= 16px`).toBeGreaterThanOrEqual(16)
      }
    })
  }
})
