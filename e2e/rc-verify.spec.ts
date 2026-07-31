/**
 * RC verification (BROWSER) — proves the deployed build actually contains:
 *  (1) the operator contacts import UI and how to reach it, and
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

test('1) Operator import UI is reachable via ?operator=1 and imports contacts', async ({ page }) => {
  await page.goto('/?operator=1', { waitUntil: 'networkidle', timeout: 30_000 })
  // Home → tap the messages entry (Abu הודעות).
  await page.getByRole('button', { name: /הודעות/ }).first().click()

  // Operator setup is shown (NOT the family grid), with per-contact rows.
  const setup = page.getByTestId('family-contacts-setup')
  await expect(setup).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('setup-row-mor')).toBeVisible()

  // The JSON import is OPEN at the top of the setup (no digging required).
  const json = page.getByTestId('setup-adv-json')
  await expect(json).toBeVisible()

  // Import SYNTHETIC contacts using SMART/CURLY quotes + a BOM (the mobile-paste
  // corruption that broke JSON.parse). Data is valid; the importer must sanitize.
  await json.fill('﻿[{ “id”: “mor”, “enabled”: true, “phoneE164”: “+972500000456” }]')
  await page.getByTestId('setup-adv-import').click()
  await expect(page.getByTestId('setup-adv-banner-ok')).toBeVisible()
  await expect(page.getByTestId('setup-active-count')).toHaveAttribute('data-active-count', '1')

  // After a successful import the operator can jump straight to the family board,
  // and the imported contact is immediately actionable (Call / WhatsApp).
  await page.getByTestId('setup-adv-view-family').click()
  await expect(page.getByTestId('family-quick-faces')).toBeVisible()
  const mor = page.getByTestId('bubble-person-mor')
  await expect(mor).toBeVisible()
  await page.getByTestId('bubble-person-tap-mor').click()
  await expect(page.getByTestId('chip-whatsapp-mor')).toBeVisible()
  await expect(page.getByTestId('chip-call-mor')).toBeVisible()
})

test('1b) Debug panel localizes a structural parse error the operator cannot see', async ({ page }) => {
  await page.goto('/?operator=1', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: /הודעות/ }).first().click()
  await expect(page.getByTestId('family-contacts-setup')).toBeVisible({ timeout: 10_000 })
  const json = page.getByTestId('setup-adv-json')

  // Missing comma between two properties → valid-looking first/last 100, real
  // structural error in the middle. The panel must surface the exact offset,
  // the byte-identity verdict, a SHA-256, and the text around the fault.
  await json.fill('[{ "id": "mor" "enabled": true, "phoneE164": "+972500000456" }]')
  await page.getByTestId('setup-adv-debug').click()
  const box = page.getByTestId('setup-adv-debug-box')
  await expect(box).toContainText('JSON.parse: ERROR')
  await expect(box).toContainText('byte-identical to paste: YES')
  await expect(box).toContainText('error at: offset')
  await expect(box).toContainText('sha-256(paste):')
})

test('3) Operator Mode persists across a reload without ?operator, and ?operator=0 clears it', async ({ page }) => {
  // Enable via ?operator=1, then reach the WhatsApp screen operator setup.
  await page.goto('/?operator=1', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: /הודעות/ }).first().click()
  await expect(page.getByTestId('family-contacts-setup')).toBeVisible({ timeout: 10_000 })

  // Reload WITHOUT the query param (mimics an installed-PWA launch) → still operator.
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: /הודעות/ }).first().click()
  await expect(page.getByTestId('family-contacts-setup')).toBeVisible({ timeout: 10_000 })

  // Explicitly disable → operator tools gone (family grid instead).
  await page.goto('/?operator=0', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: /הודעות/ }).first().click()
  await expect(page.getByTestId('family-contacts-setup')).toHaveCount(0)
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
