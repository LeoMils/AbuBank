/**
 * PREVIEW proof for the תעודת המשפחה (Family Record) screen — drives the REAL deployed
 * build in a mobile browser: Home → Settings → 📜 תעודת המשפחה, then a full round-trip
 * render → paste → diff → approve → the record updates (and a poison line is refused).
 *
 *   PREVIEW_URL=https://abu-bank-XXXX.vercel.app npx playwright test \
 *     e2e/family-record-screen.spec.ts --project=mobile-chrome
 *
 * Evidence class: PREVIEW (the deployed build, client-side ledger, real browser).
 */
import { test, expect, type Page } from '@playwright/test'

async function openFamilyRecord(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.evaluate(() => { try { localStorage.clear() } catch { /* */ } })
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.locator('[aria-label="הגדרות"]').first().click()
  // The link lives inside the collapsed "אודות Abu-ela" accordion — expand it first.
  await page.locator('text=אודות Abu-ela').first().click()
  const open = page.locator('[data-testid="open-family-record"]')
  await open.waitFor({ state: 'attached', timeout: 10_000 })
  await open.scrollIntoViewIfNeeded()
  await open.click()
  await page.locator('[data-testid="family-record-view"]').waitFor({ state: 'visible', timeout: 10_000 })
}

test('family record: renders the ledger, commits a clean fact on tap, refuses a poison line', async ({ page }) => {
  await openFamilyRecord(page)

  // 1. The canonical Hebrew ledger renders (seeded family + header).
  const view = page.locator('[data-testid="family-record-view"]')
  await expect(view).toContainText('פנקס המשפחה')

  // 2. Paste one clean fact + one poison line, run the diff.
  await page.locator('[data-testid="family-record-paste"]').fill('דני גר בתל אביב\nאופיר היא אשתו של רפי')
  await page.locator('[data-testid="family-record-check"]').click()
  const diff = page.locator('[data-testid="family-record-diff"]')
  await expect(diff).toBeVisible()

  // 3. Commit the clean fact on tap → the rendered record now contains it.
  await page.locator('[data-testid="family-record-commit-0"]').click()
  await expect(view).toContainText('תל אביב')

  // 4. The poison line (row 1) — committing it must be REFUSED, nothing about Ofir/Rafi marriage lands.
  const beforePoison = await view.textContent()
  await page.locator('[data-testid="family-record-commit-1"]').click()
  const row1 = diff.locator('> div').nth(1)
  await expect(row1).toContainText('לא רשמתי')
  // The rendered record did not gain a Rafi↔Ofir spouse edge.
  const afterPoison = await view.textContent()
  expect(afterPoison).toBe(beforePoison)
})
