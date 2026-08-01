/**
 * Settings → Contact Management (BROWSER). Proves the feature is reachable from
 * Settings, the simple form adds a contact with validation, and the advanced
 * JSON workflow validates → previews → merge-saves. Contacts are device-local.
 */
import { test, expect } from '@playwright/test'

async function openContactManagement(page: import('@playwright/test').Page) {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: 'הגדרות' }).first().click()
  // Expand the Contact Management accordion section.
  await page.getByRole('button', { name: /ניהול אנשי קשר/ }).click()
  await expect(page.getByTestId('contact-management')).toBeVisible({ timeout: 10_000 })
}

test('simple form adds a contact with validation; board reflects it', async ({ page }) => {
  await openContactManagement(page)

  // Add via the simple form.
  await page.getByTestId('cm-add').click()
  await expect(page.getByTestId('cm-edit-form')).toBeVisible()

  // Enabling with no number is a specific, blocked error.
  await page.getByTestId('cm-save').click()
  await expect(page.getByTestId('cm-err-enabled')).toBeVisible()

  // Fill a valid Israeli local number (normalizes to +972…) and save.
  await page.getByTestId('cm-field-phone').fill('0501234567')
  await page.getByTestId('cm-save').click()

  // A row now exists for the first addable person (mor is first in scaffold).
  await expect(page.getByTestId('cm-row-mor')).toBeVisible()

  // And the family board reflects it: mor is actionable.
  await page.goto('/?operator=1', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: /הודעות/ }).first().click()
  await expect(page.getByTestId('family-quick-faces')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('bubble-person-tap-mor').click()
  await expect(page.getByTestId('chip-whatsapp-mor')).toBeVisible()
})

test('advanced JSON: invalid JSON is explained and saves nothing; valid merges after preview', async ({ page }) => {
  await openContactManagement(page)
  await page.getByTestId('cm-tab-advanced').click()
  const json = page.getByTestId('cm-json')

  // Invalid JSON → explained, nothing saved, list untouched.
  await json.fill('[{ "id": "mor" "enabled": true, "phoneE164": "+972500000001" }]')
  await page.getByTestId('cm-validate').click()
  await expect(page.getByTestId('cm-preview-error')).toBeVisible()
  await expect(page.getByTestId('cm-merge-save')).toBeDisabled()

  // Valid JSON → preview shows the added contact, then merge-save persists.
  await json.fill('[{ "id": "leo", "enabled": true, "phoneE164": "+972500000002" }]')
  await page.getByTestId('cm-validate').click()
  await expect(page.getByTestId('cm-preview')).toContainText('נוספים: 1')
  await page.getByTestId('cm-merge-save').click()
  await expect(page.getByTestId('cm-banner')).toContainText('נשמר')

  // Persisted: reload Settings → the simple form lists leo.
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: 'הגדרות' }).first().click()
  await page.getByRole('button', { name: /ניהול אנשי קשר/ }).click()
  await expect(page.getByTestId('cm-row-leo')).toBeVisible()
})
