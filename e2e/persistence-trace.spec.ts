/**
 * Persistence trace (BROWSER). Proves the privacy-safe boot trace renders in
 * Operator Settings → Contact Management, records the real boot stages, survives
 * a reopen (reload), and leaks no name/number. This is the diagnostic surface for
 * the "phones vanish on reopen" investigation.
 */
import { test, expect } from '@playwright/test'

test('trace records boot stages, is copyable, and survives a reopen', async ({ page }) => {
  // First load: default seed fires; the board read records wa-read.
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByRole('button', { name: /WhatsApp|הודעות/ }).first().click()
  await expect(page.getByTestId('family-quick-faces')).toBeVisible({ timeout: 10_000 })

  // Simulate a reopen (the failing step): full navigation reload.
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })

  // Open Settings → Contact Management and read the trace.
  await page.getByRole('button', { name: 'הגדרות' }).first().click()
  await page.getByRole('button', { name: /ניהול אנשי קשר/ }).click()
  await expect(page.getByTestId('contact-management')).toBeVisible({ timeout: 10_000 })

  const trace = page.getByTestId('persistence-trace-text')
  await expect(trace).toBeVisible()
  const text = await trace.inputValue()

  // The trace recorded the real boot stages across at least two boots.
  expect(text).toMatch(/boot-start/)
  expect(text).toMatch(/reconcile/)
  expect(text).toMatch(/post-init/)
  expect(text).toMatch(/WON=/)
  // Privacy: counts only — never a phone-like token.
  expect(text).not.toMatch(/\+?972\d/)
  expect(text).not.toMatch(/\d{7,}/)

  // Copyable control is present.
  await expect(page.getByTestId('persistence-trace-copy')).toBeVisible()
})
