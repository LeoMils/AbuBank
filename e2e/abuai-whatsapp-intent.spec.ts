/**
 * Abu AI — Communication Capability handoff (evidence class: BROWSER).
 * Reproduces the reported failure ("send WhatsApp to Mor … tomorrow evening" →
 * wrong "מחר אין כלום ביומן") and proves the new behaviour: AbuAI returns a
 * generic CommunicationAction, the chat renders the draft + a single primary
 * action, and pressing it opens the correct conversation with the EXACT reviewed
 * (even edited) text prefilled — never auto-sent. Providers are blocked so the
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

  test('compose → generic action card with draft + single primary action (no calendar)', async ({ page }) => {
    await enterAbuAI(page)
    await say(page, 'תכתבי למור שמחר בערב אני אביא קולה')

    const card = page.getByTestId('communication-action-card')
    await card.waitFor({ state: 'visible', timeout: 20_000 })
    expect(await card.getAttribute('data-channel')).toBe('whatsapp') // generic, adapter-driven

    const draft = page.getByTestId('communication-draft')
    const draftText = await draft.inputValue()
    expect(draftText).toContain('מור')
    expect(draftText).toContain('קולה')                 // fact preserved
    await expect(page.getByTestId('communication-primary-action')).toContainText('פתחי בוואטסאפ')

    // The lead bubble is not a calendar answer.
    const bubbles = page.getByTestId('abuai-msg-assistant')
    await expect(bubbles.last()).not.toContainText('אין כלום ביומן')
  })

  test('editing the draft, then Open, hands off the EXACT reviewed text (prefill, no auto-send)', async ({ page }) => {
    let waUrl = ''
    await page.route(/wa\.me/, (route) => { waUrl = route.request().url(); return route.abort() })

    await enterAbuAI(page)
    await say(page, 'תכתבי למור שמחר בערב אני אביא קולה')
    const draft = page.getByTestId('communication-draft')
    await draft.waitFor({ state: 'visible', timeout: 20_000 })

    // Review + edit the draft.
    const edited = 'מור, מחר בערב אני מביאה קולה וגם עוגה 🎂'
    await draft.fill(edited)

    await page.getByTestId('communication-primary-action').click()
    await expect.poll(() => waUrl, { timeout: 10_000 }).toContain('wa.me/972500000456')
    const decoded = decodeURIComponent(waUrl.split('?text=')[1] ?? '')
    expect(decoded).toBe(edited) // EXACT reviewed text prefilled — nothing added, nothing sent
  })

  test('call request → name-correct hand-off, not the calendar', async ({ page }) => {
    await enterAbuAI(page)
    await say(page, 'תתקשרי למור')
    const last = page.getByTestId('abuai-msg-assistant').last()
    await expect(last).toContainText('מור', { timeout: 20_000 })
    await expect(last).not.toContainText('אין כלום ביומן')
  })
})
