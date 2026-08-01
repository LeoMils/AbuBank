/**
 * Focused-contact experience (BROWSER). Tapping a family bubble expands to a
 * large centred portrait with WhatsApp + Call primary actions and a secondary
 * "כתבי הודעה בקול". Outside-tap / close returns to the board. Synthetic contacts.
 */
import { test, expect, type Page } from '@playwright/test'

async function seedAndOpen(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('abubank.familyContacts.v1', JSON.stringify({
        v: 2, contacts: [
          { id: 'mor', displayName: 'מור', relationshipHebrew: 'הבת', enabled: true, phoneE164: '+972500000456' },
          { id: 'leo', displayName: 'לאו', relationshipHebrew: 'הבן', enabled: false, phoneE164: '' },
        ],
      }))
    } catch { /* ignore */ }
  })
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: /WhatsApp|הודעות/ }).first().click()
  await expect(page.getByTestId('family-quick-faces')).toBeVisible({ timeout: 10_000 })
}

test('(1,2) tap a contact → focused state with photo, name, relationship, WhatsApp + Call', async ({ page }) => {
  await seedAndOpen(page)
  await page.getByTestId('bubble-person-tap-mor').click()

  const focus = page.getByTestId('focused-contact')
  await expect(focus).toBeVisible()
  await expect(focus).toHaveAttribute('data-contact-id', 'mor')
  await expect(page.getByTestId('focused-name')).toHaveText('מור')
  await expect(page.getByTestId('focused-relationship')).toHaveText('הבת')
  await expect(page.getByTestId('chip-whatsapp-mor')).toBeVisible()
  await expect(page.getByTestId('chip-call-mor')).toBeVisible()
  await expect(page.getByTestId('focused-voice-mor')).toBeVisible()
})

test('(3) close button returns to the board', async ({ page }) => {
  await seedAndOpen(page)
  await page.getByTestId('bubble-person-tap-mor').click()
  await expect(page.getByTestId('focused-contact')).toBeVisible()
  await page.getByTestId('focused-close').click()
  await expect(page.getByTestId('focused-contact')).toHaveCount(0)
  await expect(page.getByTestId('family-quick-faces')).toBeVisible()
})

test('(3) outside tap (backdrop) returns to the board', async ({ page }) => {
  await seedAndOpen(page)
  await page.getByTestId('bubble-person-tap-mor').click()
  await expect(page.getByTestId('focused-contact')).toBeVisible()
  await page.getByTestId('focused-contact').click({ position: { x: 10, y: 10 } }) // backdrop
  await expect(page.getByTestId('focused-contact')).toHaveCount(0)
})

test('a not-yet-configured contact focuses and shows the missing-number message (no actions)', async ({ page }) => {
  await seedAndOpen(page)
  await page.getByTestId('bubble-person-tap-leo').click()
  await expect(page.getByTestId('focused-contact')).toBeVisible()
  await expect(page.getByTestId('focused-no-number')).toBeVisible()
  await expect(page.getByTestId('chip-whatsapp-leo')).toHaveCount(0)
})

test('(4→context) focused "כתבי הודעה בקול" opens the composer for THAT contact', async ({ page }) => {
  await seedAndOpen(page)
  await page.getByTestId('bubble-person-tap-mor').click()
  await page.getByTestId('focused-voice-mor').click()
  // The voice composer opens pre-targeted at Mor (context carried in).
  await expect(page.getByTestId('voice-compose-overlay')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('voice-compose-overlay')).toContainText('הודעה למור')
})
