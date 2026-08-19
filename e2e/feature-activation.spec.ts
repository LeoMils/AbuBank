/*
 * BROWSER proof (DEPLOYED_PREVIEW target) for two scorecard rows:
 *  • FEATURE-ACTIVATION — the ONE-STEP `?voice=realtime2` activation actually
 *    persists in a real browser (localStorage 'abu-voice-realtime-slice'='1'),
 *    survives a reload without the param, and `?voice=pipeline` deactivates it.
 *  • PWA-UPDATE — the service worker registers/activates on the deployed origin
 *    and app state (localStorage) survives a full reload (update-safe shell).
 *
 * Run against the deployed stable RC:
 *   PREVIEW_URL=https://abu-ela-rc.vercel.app npx playwright test e2e/feature-activation.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'

const SLICE_KEY = 'abu-voice-realtime-slice'

async function openAbuAI(page: Page): Promise<void> {
  // Lazy AbuAI module load runs syncRealtimeSliceFromUrl(window.location.search).
  await page.locator('text=Abu AI').first().click()
  await page.waitForTimeout(1200)
}
const slice = (page: Page) => page.evaluate((k) => localStorage.getItem(k), SLICE_KEY)

test.describe('FEATURE-ACTIVATION — one-step ?voice=realtime2 (BROWSER)', () => {
  test('activates + persists across reload; ?voice=pipeline deactivates', async ({ page }) => {
    // 1) One-step activation via URL param.
    await page.goto('/?voice=realtime2', { waitUntil: 'networkidle', timeout: 45_000 })
    await openAbuAI(page)
    expect(await slice(page), 'realtime2 param sets the slice flag').toBe('1')

    // 2) Persists across a reload WITHOUT the param (no re-activation needed).
    await page.goto('/', { waitUntil: 'networkidle', timeout: 45_000 })
    await openAbuAI(page)
    expect(await slice(page), 'flag persists without the param').toBe('1')

    // 3) Explicit deactivation via ?voice=pipeline.
    await page.goto('/?voice=pipeline', { waitUntil: 'networkidle', timeout: 45_000 })
    await openAbuAI(page)
    expect(await slice(page), 'pipeline param clears the flag').toBe('0')
  })
})

test.describe('PWA-UPDATE — service worker + state survives reload (BROWSER)', () => {
  test('SW registers/activates and localStorage survives a full reload', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 45_000 })
    // Service worker becomes ready on the deployed origin (secure context).
    const swActive = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false
      const reg = await navigator.serviceWorker.ready.catch(() => null)
      return !!(reg && (reg.active || reg.installing || reg.waiting))
    })
    expect(swActive, 'a service worker is registered/active').toBe(true)

    // App state (localStorage) must survive a full reload (update-safe shell).
    await page.evaluate(() => localStorage.setItem('abu-pwa-persist-probe', 'kept'))
    await page.reload({ waitUntil: 'networkidle', timeout: 45_000 })
    const kept = await page.evaluate(() => localStorage.getItem('abu-pwa-persist-probe'))
    expect(kept, 'localStorage survives reload/update').toBe('kept')
  })
})
