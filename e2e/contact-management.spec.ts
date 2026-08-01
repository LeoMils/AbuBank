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

test('simple form adds a NEW contact with validation; board reflects it', async ({ page }) => {
  await openContactManagement(page)
  // The default family is seeded, so rows already exist (dynamic from the store).
  await expect(page.getByTestId('cm-row-mor')).toBeVisible()

  // Add a brand-new, non-family contact.
  await page.getByTestId('cm-add').click()
  await expect(page.getByTestId('cm-edit-form')).toBeVisible()

  // Missing id + display name → specific, blocked errors (nothing saved).
  await page.getByTestId('cm-field-phone').fill('0501234567')
  await page.getByTestId('cm-save').click()
  await expect(page.getByTestId('cm-err-id')).toBeVisible()

  // Fill valid fields → saves.
  await page.getByTestId('cm-field-id').fill('saba')
  await page.getByTestId('cm-field-name').fill('סבא')
  await page.getByTestId('cm-save').click()
  await expect(page.getByTestId('cm-row-saba')).toBeVisible()

  // The family board reflects the brand-new contact: saba is actionable.
  await page.goto('/?operator=1', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: /הודעות/ }).first().click()
  await expect(page.getByTestId('family-quick-faces')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('bubble-person-tap-saba').click()
  await expect(page.getByTestId('chip-whatsapp-saba')).toBeVisible()
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

  // Valid JSON with a NEW id → preview shows it as ADDED, then merge-save persists.
  await json.fill('[{ "id": "dr-cohen", "displayName": "ד״ר כהן", "enabled": true, "phoneE164": "+972500000002" }]')
  await page.getByTestId('cm-validate').click()
  await expect(page.getByTestId('cm-preview')).toContainText('נוספים: 1')
  await page.getByTestId('cm-merge-save').click()
  await expect(page.getByTestId('cm-banner')).toContainText('נשמר')

  // Persisted: reload Settings → the simple form lists the new contact.
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: 'הגדרות' }).first().click()
  await page.getByRole('button', { name: /ניהול אנשי קשר/ }).click()
  await expect(page.getByTestId('cm-row-dr-cohen')).toBeVisible()
})
