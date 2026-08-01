/**
 * RC verification (BROWSER) — proves the deployed build routes correctly:
 *  (1) the WhatsApp button opens the FAMILY BOARD (never the admin editor),
 *      for normal users AND when operator mode is on; contact admin lives only
 *      in Settings → Contact Management, and
 *  (2) the communication routing fix (WhatsApp message that mentions a meeting
 *      is handled by the communication pipeline, NOT the calendar).
 * Runs against the same production bundle that is deployed.
 */
import { test, expect, type Page } from '@playwright/test'

async function blockProviders(page: Page) {
  await page.route(/\/api\/abuai-chat/, (r) => r.abort())
  await page.route(/generativelanguage\.googleapis\.com/, (r) => r.abort())
  await page.route(/api\.groq\.com/, (r) => r.abort())
}

test('1) WhatsApp opens the Family Board for a normal user (never the admin editor)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: /הודעות/ }).first().click()

  // The family board is the destination — bubbles, not the admin setup.
  await expect(page.getByTestId('family-quick-faces')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('family-contacts-setup')).toHaveCount(0)
  await expect(page.getByTestId('setup-adv-json')).toHaveCount(0)
  await expect(page.getByTestId('bubble-person-mor')).toBeVisible() // seeded family
})

test('1b) WhatsApp opens the Family Board even when operator mode is ON; admin is Settings-only', async ({ page }) => {
  // Persist operator mode (the state that used to force the admin landing).
  await page.goto('/?operator=1', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: /הודעות/ }).first().click()
  await expect(page.getByTestId('family-quick-faces')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('family-contacts-setup')).toHaveCount(0) // NOT the admin screen
  await expect(page.getByTestId('setup-adv-json')).toHaveCount(0)

  // Contact Management (the JSON editor) IS reachable — only from Settings.
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: 'הגדרות' }).first().click()
  await page.getByRole('button', { name: /ניהול אנשי קשר/ }).click()
  await expect(page.getByTestId('contact-management')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('cm-tab-advanced').click()
  await expect(page.getByTestId('cm-json')).toBeVisible()
})

test('5) With contacts already saved, ?operator=1 lands on the family BOARD, not setup', async ({ page }) => {
  // Seed one actionable contact before the app boots.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('abubank.familyContacts.v1', JSON.stringify({
        v: 2, contacts: [{ id: 'mor', enabled: true, phoneE164: '+972500000456' }],
      }))
    } catch { /* ignore */ }
  })
  await page.goto('/?operator=1', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: /הודעות/ }).first().click()

  // Import is DONE → the board is the home, not the setup screen.
  await expect(page.getByTestId('family-quick-faces')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('family-contacts-setup')).toHaveCount(0)
  await expect(page.getByTestId('bubble-person-mor')).toBeVisible()
  // And that contact is actionable (Call / WhatsApp).
  await page.getByTestId('bubble-person-tap-mor').click()
  await expect(page.getByTestId('chip-whatsapp-mor')).toBeVisible()
  await expect(page.getByTestId('chip-call-mor')).toBeVisible()
})

test('3) Operator persists (tab bar) yet WhatsApp always lands on the board; ?operator=0 clears', async ({ page }) => {
  await page.goto('/?operator=1', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: /הודעות/ }).first().click()
  await expect(page.getByTestId('family-quick-faces')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('abuwhatsapp-tab-bar')).toBeVisible() // operator tools present

  // Reload WITHOUT the query param (installed-PWA launch) → operator persists,
  // and the WhatsApp destination is STILL the board (not the admin editor).
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: /הודעות/ }).first().click()
  await expect(page.getByTestId('family-quick-faces')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('abuwhatsapp-tab-bar')).toBeVisible()
  await expect(page.getByTestId('family-contacts-setup')).toHaveCount(0)

  // Explicitly disable → operator tools gone; still the board.
  await page.goto('/?operator=0', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: /הודעות/ }).first().click()
  await expect(page.getByTestId('family-quick-faces')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('abuwhatsapp-tab-bar')).toHaveCount(0)
})

test('4) Multi-turn: a bare follow-up refines the SAME message, not the calendar', async ({ page }) => {
  await blockProviders(page)
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.locator('text=Abu AI').first().click()
  const ta = page.locator('textarea[placeholder]').first()
  await ta.waitFor({ state: 'visible', timeout: 10_000 })

  await ta.fill('תכתבי למור שהפגישה מחר'); await ta.press('Enter')
  await page.getByTestId('communication-action-card').first().waitFor({ state: 'visible', timeout: 20_000 })

  // Bare time correction — must stay communication.
  await ta.fill('בשמונה וחצי'); await ta.press('Enter')
  await page.waitForTimeout(1500)
  const lead = page.getByTestId('abuai-msg-assistant').last()
  await expect(lead).toContainText('פותחת הודעה')
  await expect(lead).not.toContainText('ביומן')
})

test('2) A WhatsApp message that mentions a meeting is communication, NOT calendar', async ({ page }) => {
  await blockProviders(page)
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.locator('text=Abu AI').first().click()
  const ta = page.locator('textarea[placeholder]').first()
  await ta.waitFor({ state: 'visible', timeout: 10_000 })

  await ta.fill('תכתבי למור שיש לי פגישה מחר')
  await ta.press('Enter')

  // Communication card appears; the reply is NOT a calendar answer.
  const card = page.getByTestId('communication-action-card')
  await card.waitFor({ state: 'visible', timeout: 20_000 })
  expect(await card.getAttribute('data-mode')).toBe('message')
  const lead = page.getByTestId('abuai-msg-assistant').last()
  await expect(lead).toContainText('פותחת הודעה')
  await expect(lead).not.toContainText('ביומן')
  await expect(lead).not.toContainText('אין כלום')
})
