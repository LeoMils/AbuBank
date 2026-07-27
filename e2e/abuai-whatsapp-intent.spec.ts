/**
 * Abu AI — WhatsApp/call intent is handled inline, NOT routed to the calendar.
 * Evidence class: BROWSER. Reproduces the exact reported failure ("send WhatsApp
 * to Mor … tomorrow evening" → wrong "מחר אין כלום ביומן") and proves the fix in
 * the real built app. Providers are blocked so the deterministic local composer
 * runs (reproducible without server keys).
 *
 *   npx playwright test e2e/abuai-whatsapp-intent.spec.ts --project=mobile-chrome
 */
import { test, expect, type Page } from '@playwright/test'

async function forceLocal(page: Page) {
  await page.route(/\/api\/abuai-chat/, (r) => r.abort())
  await page.route(/generativelanguage\.googleapis\.com/, (r) => r.abort())
  await page.route(/api\.groq\.com/, (r) => r.abort())
}

async function enterAbuAI(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.evaluate(async () => {
    try { localStorage.clear() } catch { /* */ }
  })
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  const ai = page.locator('text=Abu AI').first()
  await ai.waitFor({ state: 'visible', timeout: 15_000 })
  await ai.click()
  await page.locator('textarea[placeholder]').waitFor({ state: 'visible', timeout: 10_000 })
}

async function ask(page: Page, text: string): Promise<string> {
  const ta = page.locator('textarea[placeholder]')
  const before = await page.locator('[data-testid="abuai-msg-assistant"]').count()
  await ta.fill(text)
  await ta.press('Enter')
  await page.waitForFunction(
    (prev) => document.querySelectorAll('[data-testid="abuai-msg-assistant"]').length > prev,
    before,
    { timeout: 30_000 },
  )
  await page.waitForTimeout(300)
  return (await page.evaluate(() => {
    const els = document.querySelectorAll('[data-testid="abuai-msg-assistant"]')
    return els[els.length - 1]?.textContent ?? ''
  })).replace(/^\s*אבו AI\s*/, '').trim()
}

test.describe('Abu AI — WhatsApp/call intent', () => {
  test.beforeEach(async ({ page }) => { await forceLocal(page) })

  test('"תכתבי למור שמחר בערב אני אביא קולה" composes a message, not a calendar answer', async ({ page }) => {
    await enterAbuAI(page)
    const a = await ask(page, 'תכתבי למור שמחר בערב אני אביא קולה')
    expect(a).toContain('מור')                       // recipient named
    expect(a).toContain('קולה')                      // fact preserved
    expect(a).toContain('וואטסאפ')                   // directs to WhatsApp
    expect(a).not.toMatch(/אין כלום ביומן|אין כלום מחר|ביומן/) // the old bug is gone
  })

  test('"תתקשרי למור" gives a call hand-off with the name, not the calendar', async ({ page }) => {
    await enterAbuAI(page)
    const a = await ask(page, 'תתקשרי למור')
    expect(a).toContain('מור')
    expect(a).toMatch(/להתקשר|אבו וואטסאפ/)
    expect(a).not.toMatch(/ביומן|אין כלום/)
  })
})
