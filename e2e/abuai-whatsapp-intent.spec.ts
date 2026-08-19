/**
 * Abu AI — Communication Capability handoff (evidence class: BROWSER).
 * Proves the shipped behaviour in the built app: call + WhatsApp both produce a
 * generic CommunicationAction; the clear path shows ONE primary action (WhatsApp
 * is the review surface); explicit review shows an editable draft that reaches
 * the adapter byte-for-byte; nothing is auto-sent. Providers are blocked so the
 * deterministic local composer runs (reproducible without server keys).
 *
 *   npx playwright test e2e/abuai-whatsapp-intent.spec.ts --project=mobile-chrome
 */
import { test, expect, type Page } from '@playwright/test'

const MOR_PHONE = '+972500000456'

async function prime(page: Page) {
  await page.route(/\/api\/abuai-chat/, (r) => r.abort())
  await page.route(/generativelanguage\.googleapis\.com/, (r) => r.abort())
  await page.route(/api\.groq\.com/, (r) => r.abort())
  await page.addInitScript((phone) => {
    try {
      localStorage.setItem('abubank.familyContacts.v1', JSON.stringify({ v: 2, contacts: [{ id: 'mor', enabled: true, phoneE164: phone }] }))
    } catch { /* ignore */ }
  }, MOR_PHONE)
}

async function enterAbuAI(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  const ai = page.locator('text=Abu AI').first()
  await ai.waitFor({ state: 'visible', timeout: 15_000 })
  await ai.click()
  await page.locator('textarea[placeholder]').waitFor({ state: 'visible', timeout: 10_000 })
}

async function say(page: Page, text: string) {
  const ta = page.locator('textarea[placeholder]').first()
  await ta.fill(text)
  await ta.press('Enter')
}

test.describe('Abu AI — Communication Capability', () => {
  test.beforeEach(async ({ page }) => { await prime(page) })

  test('clear WhatsApp path: ONE action, no forced draft, not a calendar answer', async ({ page }) => {
    await enterAbuAI(page)
    await say(page, 'תכתבי למור שמחר בערב אני אביא קולה')

    const card = page.getByTestId('communication-action-card')
    await card.waitFor({ state: 'visible', timeout: 20_000 })
    expect(await card.getAttribute('data-mode')).toBe('message')
    await expect(page.getByTestId('communication-primary-action')).toContainText('פתחי בוואטסאפ')
    // Default flow: WhatsApp is the review surface → no editable draft shown.
    await expect(page.getByTestId('communication-draft')).toHaveCount(0)
    // Brief lead, never a calendar answer, no "are you sure".
    const lead = page.getByTestId('abuai-msg-assistant').last()
    await expect(lead).toContainText('מוכנה')
    await expect(lead).not.toContainText('אין כלום ביומן')

    // Optional review reveals the (local) draft with the fact preserved.
    await page.getByTestId('communication-reveal').click()
    await expect(page.getByTestId('communication-draft')).toContainText('קולה')
  })

  test('explicit review → editable draft reaches WhatsApp byte-for-byte (no auto-send)', async ({ page }) => {
    let waUrl = ''
    await page.route(/wa\.me/, (route) => { waUrl = route.request().url(); return route.abort() })

    await enterAbuAI(page)
    await say(page, 'תכתבי למור שמחר בערב אני אביא קולה, תראי לי לפני')
    const draft = page.getByTestId('communication-draft')       // shown because review was requested
    await draft.waitFor({ state: 'visible', timeout: 20_000 })

    const edited = 'מור, מחר בערב אני מביאה קולה וגם עוגה 🎂'
    await draft.fill(edited)
    await page.getByTestId('communication-primary-action').click()
    await expect.poll(() => waUrl, { timeout: 10_000 }).toContain('wa.me/972500000456')
    expect(decodeURIComponent(waUrl.split('?text=')[1] ?? '')).toBe(edited)
  })

  test('call request → generic call Action (mode=call), not the calendar', async ({ page }) => {
    await enterAbuAI(page)
    await say(page, 'תתקשרי למור')
    const card = page.getByTestId('communication-action-card')
    await card.waitFor({ state: 'visible', timeout: 20_000 })
    expect(await card.getAttribute('data-mode')).toBe('call')
    await expect(page.getByTestId('communication-primary-action')).toContainText('התקשרי')
    const lead = page.getByTestId('abuai-msg-assistant').last()
    await expect(lead).toContainText('מכינה שיחה')
    await expect(lead).not.toContainText('אין כלום ביומן')
  })
})
