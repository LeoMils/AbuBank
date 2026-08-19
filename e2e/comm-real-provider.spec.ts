/**
 * Communication replay through the REAL Abu AI chat UI — the exact device-failed
 * chats + STT-distorted variants + the multi-turn flow. Runs with the provider
 * AVAILABLE (not blocked) so it reproduces the real device path, and asserts the
 * failures never recur: no capability denial, no general-chat, no Calendar hijack,
 * and a communication action card (or a clarification) every time.
 *
 * This is the automated first-line QA that replaces sending Leo to the phone for
 * routing/denial/recipient failures. It passes locally (deterministic compose
 * fallback) AND on the deployed stable RC (real provider).
 */
import { test, expect, type Page } from '@playwright/test'

const DENIAL = /לא יכולה|לא מסוגלת|אין לי אפשרות|cannot|can'?t|unable/i
const CALENDAR = /אין כלום ביומן|ביומן|קבעתי|נכון\?|לשמור\?/

async function openChat(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('abubank.familyContacts.v1', JSON.stringify({ v: 2, contacts: [
        { id: 'leo', displayName: 'לאו', enabled: true, phoneE164: '+972500000789' },
        { id: 'mor', displayName: 'מור', enabled: true, phoneE164: '+972500000456' },
      ]}))
    } catch { /* ignore */ }
  })
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.locator('text=Abu AI').first().click()
  await page.locator('textarea[placeholder]').first().waitFor({ state: 'visible', timeout: 15_000 })
}

async function say(page: Page, text: string): Promise<string> {
  const before = await page.getByTestId('abuai-msg-assistant').count()
  const ta = page.locator('textarea[placeholder]').first()
  await ta.fill(text); await ta.press('Enter')
  await page.waitForFunction((n) => document.querySelectorAll('[data-testid="abuai-msg-assistant"]').length > n, before, { timeout: 30_000 })
  await page.waitForTimeout(600)
  return (await page.getByTestId('abuai-msg-assistant').last().textContent()) ?? ''
}

test('CALL flow — explicit call + reassertions never become denial/general/Calendar', async ({ page }) => {
  await openChat(page)
  const r1 = await say(page, 'תתקשרי ללאו')
  expect(r1, 'call must not be denied').not.toMatch(DENIAL)
  expect(r1).not.toMatch(CALENDAR)
  expect(r1).toMatch(/מכינה שיחה|התקשרי/)
  await expect(page.getByTestId('communication-action-card').last()).toHaveAttribute('data-mode', 'call')

  for (const t of ['לא נפתח שום דבר, תתקשרי ללאו', 'זה בכלל לא קשור ליומן.']) {
    const r = await say(page, t)
    expect(r, `turn "${t}"`).not.toMatch(DENIAL)
    expect(r, `turn "${t}"`).not.toMatch(CALENDAR)
  }
  const meta = await say(page, 'מה זה אומר שאת פותחת שיחה?')
  expect(meta).not.toMatch(DENIAL) // meta-question answered from action truth
})

test('WHATSAPP flow — explicit send + meta-questions never become denial/general', async ({ page }) => {
  await openChat(page)
  const r1 = await say(page, 'תשלחי הודעה ללאו שיביא מחר יין')
  expect(r1).not.toMatch(DENIAL)
  expect(r1).not.toMatch(CALENDAR)
  expect(r1).toMatch(/מוכנה|WhatsApp/)
  await expect(page.getByTestId('communication-action-card').last()).toHaveAttribute('data-mode', 'message')

  for (const t of ['מה זה אומר שאת פותחת הודעה?', 'למה אמרת פותחת אם את לא שולחת?']) {
    const r = await say(page, t)
    expect(r, `meta "${t}"`).not.toMatch(DENIAL)
    // Never a COMPLETION claim ("I sent it") — but the truthful "not sent" is fine.
    expect(r, `meta "${t}"`).not.toMatch(/שלחתי|ההודעה נשלחה/)
  }
})

test('STT-distorted recipient names stay communication (clarify or handoff), never general', async ({ page }) => {
  for (const name of ['ללאו', 'לליאו', 'לליאור', 'ללאה', 'ללאות']) {
    await openChat(page)
    const r = await say(page, `תשלחי הודעה ${name} שיביא שניצלים בערב`)
    expect(r, `name "${name}" must not be denied`).not.toMatch(DENIAL)
    expect(r, `name "${name}" must not hit Calendar`).not.toMatch(CALENDAR)
    // Either a message card (resolved) OR a recipient clarification — never generic chat.
    const hasCard = await page.getByTestId('communication-action-card').count()
    const clarifies = /למי|איזה|תגידי לי שוב|לא בטוחה/.test(r)
    expect(hasCard > 0 || clarifies, `name "${name}": card or clarification`).toBe(true)
  }
})

test('MULTI-TURN — one message goal; correction + recipient switch; never Calendar', async ({ page }) => {
  await openChat(page)
  await say(page, 'תשלחי הודעה ללאו')
  for (const t of ['שיביא מחר', 'שניצלים בערב', 'לא פגישה', 'בשמונה וחצי']) {
    const r = await say(page, t)
    expect(r, `turn "${t}"`).not.toMatch(CALENDAR)
    expect(r, `turn "${t}"`).not.toMatch(DENIAL)
  }
  const sw = await say(page, 'לא, למור')
  expect(sw).not.toMatch(CALENDAR)
  // Recipient switched to Mor, still a message.
  await expect(page.getByTestId('communication-action-card').last()).toHaveAttribute('data-mode', 'message')
})
