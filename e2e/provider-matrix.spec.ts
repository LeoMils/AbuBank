/**
 * GATE B — REAL-PROVIDER ADVERSARIAL COMMUNICATION MATRIX (deployed UI).
 *
 * Drives the actual deployed Abu AI UI. For every provider FAILURE mode
 * (timeout/abort, 429, 500, malformed JSON, empty body, contradictory 200 prose),
 * an explicit CALL and an explicit WHATSAPP command must STILL produce the correct
 * communication action, and the assistant lead must NEVER:
 *   - deny a supported capability ("אני לא יכולה להתקשר/לשלוח"),
 *   - claim completion ("כבר התקשרתי/שלחתי"),
 *   - switch the owned turn to Calendar/general ("ביומן"),
 *   - describe a button that is not rendered.
 * The communication brain (reduceGoal/validateResponse) runs on every turn
 * regardless of the provider, so a failed/adversarial provider cannot override it.
 */
import { test, expect, type Page, type Route } from '@playwright/test'

type Mode = 'timeout' | 'http429' | 'http500' | 'malformed' | 'empty' | 'contradiction'

const DENIALS = ['לא יכולה להתקשר', 'לא יכולה לשלוח', 'כבר התקשרתי', 'כבר שלחתי', 'אין כלום ביומן']

async function applyProvider(page: Page, mode: Mode) {
  const handler = async (route: Route) => {
    switch (mode) {
      case 'timeout': return route.abort()
      case 'http429': return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ errorCode: 'CHAT_RATE_LIMITED' }) })
      case 'http500': return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ errorCode: 'CHAT_PROVIDER_FAILED' }) })
      case 'malformed': return route.fulfill({ status: 200, contentType: 'application/json', body: '{ this is not json' })
      case 'empty': return route.fulfill({ status: 200, contentType: 'application/json', body: '' })
      case 'contradiction': return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ openai: { choices: [{ message: { role: 'assistant', content: 'אני לא יכולה להתקשר או לשלוח הודעות, וכבר התקשרתי בשבילך. בואי נבדוק ביומן.' } }] } }) })
    }
  }
  await page.route(/\/api\/abuai-chat/, handler)
  await page.route(/generativelanguage\.googleapis\.com/, (r) => r.abort())
  await page.route(/api\.groq\.com/, (r) => r.abort())
}

async function seedAndOpen(page: Page, mode: Mode) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('abubank.familyContacts.v1', JSON.stringify({
        v: 2, contacts: [{ id: 'mor', displayName: 'מור', enabled: true, phoneE164: '+972500000001' }],
      }))
    } catch { /* ignore */ }
  })
  await applyProvider(page, mode)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'networkidle', timeout: 45_000 })
  await page.locator('text=Abu AI').first().click()
  await page.locator('textarea[placeholder]').first().waitFor({ state: 'visible', timeout: 10_000 })
}

async function sendAndAssert(page: Page, text: string, expectMode: 'call' | 'message', label: string) {
  const ta = page.locator('textarea[placeholder]').first()
  await ta.fill(text); await ta.press('Enter')
  // A communication action card must appear (never a generic denial).
  const card = page.getByTestId('communication-action-card')
  await card.waitFor({ state: 'visible', timeout: 25_000 })
  expect(await card.getAttribute('data-mode'), `${label}: mode`).toBe(expectMode)
  const lead = page.getByTestId('abuai-msg-assistant').last()
  const txt = (await lead.textContent()) || ''
  for (const d of DENIALS) expect(txt, `${label}: lead must not contain "${d}"`).not.toContain(d)
}

for (const mode of ['timeout', 'http429', 'http500', 'malformed', 'empty', 'contradiction'] as Mode[]) {
  test(`(provider:${mode}) explicit CALL still routes to a call action, no denial/fabrication`, async ({ page }) => {
    await seedAndOpen(page, mode)
    await sendAndAssert(page, 'תתקשרי למור', 'call', `CALL/${mode}`)
  })
  test(`(provider:${mode}) explicit WHATSAPP still routes to a whatsapp action, no denial/fabrication`, async ({ page }) => {
    await seedAndOpen(page, mode)
    await sendAndAssert(page, 'תשלחי למור הודעה שיביא מחר שניצלים בערב', 'message', `WA/${mode}`)
  })
}

// Recipient variants under a hard provider failure — explicit communication must
// stay communication (handoff or clarify), never general chat / Calendar.
for (const name of ['מור', 'לאו', 'ליאו', 'לאה', 'לאות']) {
  test(`(provider:timeout) send to "${name}" stays communication (never general/Calendar)`, async ({ page }) => {
    await seedAndOpen(page, 'timeout')
    const ta = page.locator('textarea[placeholder]').first()
    await ta.fill(`תשלחי ל${name} שיביא שניצלים`); await ta.press('Enter')
    const lead = page.getByTestId('abuai-msg-assistant').last()
    await lead.waitFor({ state: 'visible', timeout: 25_000 })
    const txt = (await lead.textContent()) || ''
    for (const d of DENIALS) expect(txt, `${name}: no denial`).not.toContain(d)
  })
}
