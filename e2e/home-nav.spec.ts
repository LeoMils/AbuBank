/**
 * J02 — Home portal navigation. Each Home orb routes to the correct module.
 * Forward nav from a fresh Home each time (deterministic; back-nav is covered by
 * each module's own Shell/back affordance). Closes the Home-nav coverage gap.
 */
import { test, expect, type Page } from '@playwright/test'

async function home(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 })
}

test('Home -> Abu AI opens the conversation composer', async ({ page }) => {
  await home(page)
  await page.getByRole('button', { name: /Abu AI/ }).first().click()
  await expect(page.locator('textarea[placeholder]').first()).toBeVisible({ timeout: 15000 })
})

test('Home -> Abu WhatsApp opens the family board', async ({ page }) => {
  await home(page)
  await page.getByRole('button', { name: /WhatsApp|הודעות/ }).first().click()
  await expect(page.getByTestId('family-quick-faces')).toBeVisible({ timeout: 15000 })
})

test('Home -> Abu Weather opens the weather screen', async ({ page }) => {
  await page.route(/api\.open-meteo\.com/, (r) => r.abort()) // deterministic: degraded state
  await home(page)
  await page.getByRole('button', { name: /מזג אוויר/ }).first().click()
  // Weather screen mounted (loading or the honest error — never Home).
  await expect(page.getByText(/מזג אוויר|לא הצלחתי לבדוק/).first()).toBeVisible({ timeout: 15000 })
})

test('Home -> Settings opens settings', async ({ page }) => {
  await home(page)
  await page.getByRole('button', { name: /הגדרות/ }).first().click()
  await expect(page.getByRole('button', { name: /ניהול אנשי קשר/ })).toBeVisible({ timeout: 15000 })
})
