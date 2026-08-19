/**
 * EXACT real-device conversation replay — the original failure.
 * Communication must own the whole conversation; Calendar must never activate;
 * every follow-up updates the same message; "בשמונה וחצי" stays in the message.
 * Providers blocked → deterministic local composer.
 */
import { test, expect, type Page } from '@playwright/test'

const CAL = /אין כלום ביומן|ביומן|קבעתי|נכון\?|לשמור\?|באיזו שעה|מתי.*פגישה/

async function prime(page: Page) {
  await page.route(/\/api\/abuai-chat/, (r) => r.abort())
  await page.route(/generativelanguage\.googleapis\.com/, (r) => r.abort())
  await page.route(/api\.groq\.com/, (r) => r.abort())
  await page.addInitScript(() => {
    try {
      localStorage.setItem('abubank.familyContacts.v1', JSON.stringify({ v: 2, contacts: [
        { id: 'leo', enabled: true, phoneE164: '+972500000789' },
        { id: 'mor', enabled: true, phoneE164: '+972500000456' },
      ] }))
    } catch { /* ignore */ }
  })
}

async function enterAbuAI(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.locator('text=Abu AI').first().click()
  await page.locator('textarea[placeholder]').waitFor({ state: 'visible', timeout: 10_000 })
}

async function say(page: Page, text: string): Promise<string> {
  const before = await page.getByTestId('abuai-msg-assistant').count()
  const ta = page.locator('textarea[placeholder]').first()
  await ta.fill(text); await ta.press('Enter')
  await page.waitForFunction((p) => document.querySelectorAll('[data-testid="abuai-msg-assistant"]').length > p, before, { timeout: 25_000 })
  await page.waitForTimeout(300)
  return (await page.getByTestId('abuai-msg-assistant').last().textContent()) ?? ''
}

test('exact multi-turn conversation stays in communication, never Calendar', async ({ page }) => {
  await prime(page)
  await enterAbuAI(page)

  // Turn 1 — communication owns from the first utterance (asks what to write).
  const r1 = await say(page, 'תשלח הודעה ללאו')
  expect(r1).not.toMatch(CAL)

  // Turns 2-5 — every follow-up updates the SAME message; never Calendar.
  for (const t of ['שיבוא היום בערב', 'עם יין', 'לא פגישה', 'בשמונה וחצי']) {
    const r = await say(page, t)
    expect(r, `turn "${t}"`).toMatch(/מוכנה|WhatsApp/)
    expect(r, `turn "${t}"`).not.toMatch(CAL)
  }

  // The pending WhatsApp message contains the accumulated facts; "לא פגישה" added no meeting.
  await page.getByTestId('communication-action-card').last().scrollIntoViewIfNeeded()
  await page.getByTestId('communication-reveal').last().click()
  const draft = await page.getByTestId('communication-draft').last().inputValue()
  expect(draft).toContain('יין')
  expect(draft).toContain('שמונה')      // "בשמונה וחצי" is in the message
  expect(draft).not.toContain('פגישה')  // "לא פגישה" did not inject a meeting word

  // Call — separate, correct.
  const rc = await say(page, 'תתקשר למור')
  expect(rc).toMatch(/מכינה שיחה|החייגן/)
  expect(rc).not.toMatch(CAL)
  const card = page.getByTestId('communication-action-card').last()
  expect(await card.getAttribute('data-mode')).toBe('call')
})
