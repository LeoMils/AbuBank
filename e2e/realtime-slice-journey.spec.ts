/**
 * ADR-0001 §18 vertical-slice — DEPLOYED FALSIFIER (evidence class: BROWSER/PREVIEW).
 * Proves, in the built/deployed app (no mic), that the Realtime slice harness renders
 * the canonical ActiveActionCard and performs the exact device-failure journey:
 *   greeting-once → WhatsApp card → "לא, תתקשרי אליו" atomically REPLACES to Call →
 *   complaint does NOT mutate → a fabricated completion is blocked → card never shows
 *   a sent/called claim. Gated behind ?voice=realtime2 (OFF by default).
 *
 *   PREVIEW_URL=<preview> npx playwright test e2e/realtime-slice-journey.spec.ts --project=mobile-chrome
 */
import { test, expect, type Page } from '@playwright/test'

async function enterSlice(page: Page) {
  await page.goto('/?voice=realtime2', { waitUntil: 'networkidle', timeout: 30_000 })
  const ai = page.locator('text=Abu AI').first()
  await ai.waitFor({ state: 'visible', timeout: 15_000 })
  await ai.click()
  await page.getByTestId('realtime-slice-harness').waitFor({ state: 'visible', timeout: 15_000 })
}

test.describe('Realtime slice §18 — deployed, no mic', () => {
  test('greeting-once → WhatsApp → atomic REPLACE to Call → complaint no-mutation → speech guard', async ({ page }) => {
    await enterSlice(page)

    // Greeting fires exactly once (the repeated-greeting device bug).
    await page.getByTestId('slice-greet').click()
    await expect(page.getByTestId('slice-readout')).toContainText('greeted=true')
    await page.getByTestId('slice-greet').click()
    await expect(page.getByTestId('slice-readout')).toContainText('greeted=false')

    // 1) WhatsApp start → the canonical card commits at revision 1, message kind.
    await page.getByTestId('slice-start').click()
    const card = page.getByTestId('active-action-card')
    await card.waitFor({ state: 'visible', timeout: 10_000 })
    expect(await card.getAttribute('data-kind')).toBe('message')
    expect(await card.getAttribute('data-revision')).toBe('1')
    await expect(page.getByTestId('active-action-primary')).toContainText('פתחי בוואטסאפ')

    // 2) "לא, תתקשרי אליו" → the SAME card atomically becomes a Call at a new revision.
    await page.getByTestId('slice-replace').click()
    await expect(card).toHaveAttribute('data-kind', 'call', { timeout: 10_000 })
    expect(await card.getAttribute('data-revision')).toBe('2')
    await expect(page.getByTestId('active-action-primary')).toContainText('התקשרי')
    // Exactly one active action, and it superseded the WhatsApp card.
    await expect(page.getByTestId('slice-readout')).toContainText('active=1')
    await expect(page.getByTestId('slice-readout')).toContainText('supersedes=act_')

    // 3) A complaint must NOT mutate the action.
    await page.getByTestId('slice-complaint').click()
    await expect(card).toHaveAttribute('data-kind', 'call')

    // 4) Speech guard: a fabricated completion is blocked before it could be voiced.
    await page.getByTestId('slice-speech-in').fill('שלחתי למור את ההודעה')
    await page.getByTestId('slice-speech-check').click()
    await expect(page.getByTestId('slice-speech-out')).toContainText('BLOCKED')

    // The card itself never renders a completion claim.
    for (const bad of ['שלחתי', 'התקשרתי', 'חייגתי', 'נשלח']) {
      await expect(card).not.toContainText(bad)
    }
  })
})
