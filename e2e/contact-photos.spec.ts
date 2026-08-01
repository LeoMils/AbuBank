/**
 * Contact photos (BROWSER). Proves the dynamic Family Board shows each contact's
 * real photo from the store, the one-time migration backfills bundled photos for
 * existing contacts, and the simple-form upload (resize on device) → board is
 * immediate. Synthetic images + synthetic contacts only — never real photos.
 */
import { test, expect, type Page } from '@playwright/test'

// 1x1 transparent PNG (synthetic — no real image data).
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

async function seed(page: Page, contacts: unknown[]) {
  await page.addInitScript((c) => {
    try { localStorage.setItem('abubank.familyContacts.v1', JSON.stringify({ v: 2, contacts: c })) } catch { /* ignore */ }
  }, contacts)
}
async function openCM(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: 'הגדרות' }).first().click()
  await page.getByRole('button', { name: /ניהול אנשי קשר/ }).click()
  await expect(page.getByTestId('contact-management')).toBeVisible({ timeout: 10_000 })
}
async function openBoard(page: Page) {
  await page.goto('/?operator=1', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: /הודעות/ }).first().click()
  await expect(page.getByTestId('family-quick-faces')).toBeVisible({ timeout: 10_000 })
}

test('(1) migration: an existing contact with no photo shows the bundled photo on the board', async ({ page }) => {
  // Pre-photo store: mor enabled with a number but NO photo (an old import).
  await seed(page, [{ id: 'mor', displayName: 'מור', enabled: true, phoneE164: '+972500000456' }])
  await openBoard(page)
  const img = page.locator('[data-testid="bubble-person-mor"] img')
  await expect(img).toHaveAttribute('src', /\/family-contacts\/mor\.jpeg/)
})

test('(5,8) uploaded image appears immediately on the board for a brand-new contact', async ({ page }) => {
  await openCM(page)
  await page.getByTestId('cm-add').click()
  await page.getByTestId('cm-field-id').fill('saba')
  await page.getByTestId('cm-field-name').fill('סבא')
  await page.getByTestId('cm-field-phone').fill('0501234567')
  // Upload a synthetic image → resized on device → preview becomes a data URL.
  await page.getByTestId('cm-field-photo').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG_1x1 })
  await expect(page.getByTestId('cm-photo-preview')).toHaveAttribute('src', /^data:image\//, { timeout: 10_000 })
  await page.getByTestId('cm-save').click()
  await expect(page.getByTestId('cm-row-saba')).toBeVisible()

  await openBoard(page)
  await expect(page.locator('[data-testid="bubble-person-saba"] img')).toHaveAttribute('src', /^data:image\//)
})

test('(7) removing an arbitrary contact photo falls back to initials (no broken image)', async ({ page }) => {
  // Arbitrary (non-family) contact has no bundled default → remove → initials.
  await seed(page, [{ id: 'friend1', displayName: 'חבר', enabled: true, phoneE164: '+972500000456', photoDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }])
  await openCM(page)
  await page.getByTestId('cm-edit-friend1').click()
  await page.getByTestId('cm-photo-remove').click()
  await page.getByTestId('cm-save').click()

  await openBoard(page)
  await expect(page.locator('[data-testid="bubble-person-friend1"] img')).toHaveCount(0)
  await expect(page.getByTestId('bubble-person-friend1')).toContainText('ח')
})

test('(1b) self-heal: a known contact whose store lost its photoFile still shows the bundled photo', async ({ page }) => {
  // Simulates a store overwritten without photoFile (migration already applied):
  // the render-time default fallback must still show the real photo, not initials.
  await seed(page, [{ id: 'mor', displayName: 'מור', enabled: true, phoneE164: '+972500000456' }])
  // Pretend the one-time migration already ran so it will NOT backfill.
  await page.addInitScript(() => { try { localStorage.setItem('abubank.familyContacts.photoMigration.v', '1') } catch { /* ignore */ } })
  await openBoard(page)
  await expect(page.locator('[data-testid="bubble-person-mor"] img')).toHaveAttribute('src', /\/family-contacts\/mor\.jpeg/)
})
