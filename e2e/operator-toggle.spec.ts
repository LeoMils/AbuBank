/**
 * J12 — operator-mode gate (?operator=1 / ?operator=0). Runs against the
 * PRODUCTION build (vite preview) where import.meta.env.DEV is false, so the
 * canonical gate is exercised for real. The gate is evaluated lazily when an
 * operator-aware screen mounts (Abu WhatsApp), so each test opens it first, then
 * asserts the persisted canonical flag. Closes the operator on/off coverage gap.
 */
import { test, expect, type Page } from '@playwright/test'

const OP_KEY = 'abu-operator'
async function flag(page: Page): Promise<string | null> {
  return page.evaluate((k) => { try { return localStorage.getItem(k) } catch { return 'ERR' } }, OP_KEY)
}
async function openWhatsApp(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /WhatsApp|הודעות/ }).first().click()
  await page.getByTestId('family-quick-faces').waitFor({ state: 'visible', timeout: 15000 }).catch(() => { /* operator surface may differ */ })
}

test('?operator=1 enables + persists the canonical operator flag', async ({ page }) => {
  await page.goto('/?operator=1', { waitUntil: 'networkidle', timeout: 30000 })
  await openWhatsApp(page) // operator-aware screen evaluates the gate
  await expect.poll(async () => flag(page), { timeout: 10000 }).toBe('1')
  // …and it persists on a clean path (no query).
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 })
  expect(await flag(page), 'operator flag persists across navigation').toBe('1')
})

test('?operator=0 disables + clears the operator flag', async ({ page }) => {
  await page.goto('/?operator=1', { waitUntil: 'networkidle', timeout: 30000 })
  await openWhatsApp(page)
  await expect.poll(async () => flag(page), { timeout: 10000 }).toBe('1')
  // Now disable.
  await page.goto('/?operator=0', { waitUntil: 'networkidle', timeout: 30000 })
  await openWhatsApp(page)
  await expect.poll(async () => flag(page), { timeout: 10000 }).toBeNull()
})
