/**
 * GATE A (service-worker permutations) — data is independent of the service
 * worker. Gate A already proved "new build loads + data survives" across each
 * real redeploy (the SW updates on reopen). This closes the one data-loss-relevant
 * permutation: with the service worker BLOCKED entirely (no SW), a real UI import
 * still persists across a terminate/reopen — the app shell is what the SW caches,
 * never the contacts (IndexedDB/localStorage).
 */
import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import { rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const TARGET = process.env.TARGET || 'http://localhost:5183'
const PROFILE = join(tmpdir(), 'abu-sw-noworker-profile')
const IMPORT = JSON.stringify(['mor', 'leo', 'adar'].map((id, i) => ({
  id, displayName: id, enabled: true, phoneE164: ['+972', '50', ('0000000' + (i + 1)).slice(-7)].join(''),
})))

async function launch(): Promise<BrowserContext> {
  // serviceWorkers:'block' => the app runs with NO service worker at all.
  return chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 390, height: 844 }, locale: 'he-IL', serviceWorkers: 'block' })
}
async function callReady(page: Page): Promise<number> {
  await page.goto(TARGET, { waitUntil: 'networkidle', timeout: 30000 })
  await page.getByRole('button', { name: 'הגדרות' }).first().click()
  await page.getByRole('button', { name: /ניהול אנשי קשר/ }).click()
  await page.getByTestId('contact-management').waitFor({ state: 'visible', timeout: 15000 })
  const t = (await page.getByTestId('contacts-receipt').textContent()) || ''
  return Number((t.match(/call-ready:(\d+)/) || [])[1] ?? -1)
}
async function boardActionable(page: Page, id: string): Promise<boolean> {
  await page.goto(TARGET, { waitUntil: 'networkidle', timeout: 30000 })
  await page.getByRole('button', { name: /WhatsApp|הודעות/ }).first().click()
  await page.getByTestId('family-quick-faces').waitFor({ state: 'visible', timeout: 15000 })
  await page.getByTestId(`bubble-person-tap-${id}`).click()
  await page.getByTestId('focused-contact').waitFor({ state: 'visible', timeout: 10000 })
  return (await page.getByTestId(`chip-call-${id}`).count()) > 0
}

test('no service worker: real import persists across terminate/reopen', async () => {
  test.setTimeout(120000)
  try { rmSync(PROFILE, { recursive: true, force: true }) } catch { /* ignore */ }
  mkdirSync(PROFILE, { recursive: true })

  // Import through the real UI with the SW blocked.
  let ctx = await launch()
  let page = ctx.pages()[0] || await ctx.newPage()
  await page.goto(TARGET, { waitUntil: 'networkidle', timeout: 30000 })
  await page.getByRole('button', { name: 'הגדרות' }).first().click()
  await page.getByRole('button', { name: /ניהול אנשי קשר/ }).click()
  await page.getByTestId('cm-tab-advanced').click()
  await page.getByTestId('cm-json').fill(IMPORT)
  await page.getByTestId('cm-validate').click()
  await page.getByTestId('cm-preview').waitFor({ state: 'visible', timeout: 10000 })
  await page.getByTestId('cm-merge-save').click()
  await page.waitForTimeout(1200)
  expect(await callReady(page)).toBeGreaterThanOrEqual(3)
  await ctx.close()

  // Reopen with the SW still blocked — contacts survive (data is not SW-cached).
  ctx = await launch()
  page = ctx.pages()[0] || await ctx.newPage()
  expect(await boardActionable(page, 'mor'), 'no-SW reopen: mor actionable').toBe(true)
  expect(await callReady(page), 'no-SW reopen: call-ready').toBeGreaterThanOrEqual(3)
  await ctx.close()
})
