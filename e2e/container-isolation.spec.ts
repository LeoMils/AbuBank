/**
 * TWO-CONTAINER QA — Safari jar vs installed-PWA jar.
 *
 * Models iOS storage-container isolation with two independent browser contexts and
 * emulates the two iOS modes (navigator.standalone false/true) on the CANONICAL
 * host. Proves: storage in one jar is not visible in the other; the app detects
 * and explains the difference; import is BLOCKED/warned on an iOS Safari tab; and
 * the canonical PWA import persists across reopen. Runs against the deployed
 * canonical origin (the classifier only engages on the canonical host).
 */
import { test, expect, type Browser, type BrowserContext } from '@playwright/test'

const BASE = process.env.PREVIEW_URL || 'https://abu-ela-rc.vercel.app'
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
const CONTACTS = JSON.stringify(['mor', 'leo'].map((id, i) => ({ id, displayName: id, enabled: true, phoneE164: ['+972', '50', ('0000000' + (i + 1)).slice(-7)].join('') })))

async function iosContext(browser: Browser, standalone: boolean): Promise<BrowserContext> {
  const ctx = await browser.newContext({ userAgent: IPHONE_UA, viewport: { width: 390, height: 844 }, locale: 'he-IL' })
  await ctx.addInitScript((sa) => {
    try { Object.defineProperty(navigator, 'standalone', { get: () => sa, configurable: true }) } catch { /* ignore */ }
  }, standalone)
  return ctx
}
async function openCM(page: import('@playwright/test').Page) {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 })
  await page.getByRole('button', { name: 'הגדרות' }).first().click()
  await page.getByRole('button', { name: /ניהול אנשי קשר/ }).click()
  await page.getByTestId('contact-management').waitFor({ state: 'visible', timeout: 15000 })
}
async function callReady(page: import('@playwright/test').Page): Promise<number> {
  const t = (await page.getByTestId('contacts-receipt').textContent()) || ''
  return Number((t.match(/call-ready:(\d+)/) || [])[1] ?? -1)
}

test('storage written in one jar is NOT visible in another (container isolation)', async ({ browser }) => {
  const a = await iosContext(browser, true)
  const pa = await a.newPage()
  await pa.addInitScript((c) => { try { localStorage.setItem('abubank.familyContacts.v1', c) } catch { /**/ } }, CONTACTS)
  await openCM(pa)
  expect(await callReady(pa), 'jar A has the seeded contacts').toBeGreaterThanOrEqual(2)

  const b = await iosContext(browser, true) // a DIFFERENT context = a different jar
  const pb = await b.newPage()
  await openCM(pb)
  expect(await callReady(pb), 'jar B does NOT see jar A data').toBe(0)
  await a.close(); await b.close()
})

test('iOS Safari tab (wrong jar): import is BLOCKED with the canonical-PWA guidance', async ({ browser }) => {
  const ctx = await iosContext(browser, false) // navigator.standalone = false => Safari
  const page = await ctx.newPage()
  await openCM(page)
  const banner = page.getByTestId('container-guard-banner')
  await expect(banner, 'Safari tab must show the canonical-container guidance').toBeVisible({ timeout: 10000 })
  expect(await banner.getAttribute('data-class')).toBe('SAFARI_BROWSER')
  await expect(page.getByTestId('contacts-receipt')).toContainText('container:SAFARI_BROWSER')

  // Attempting to import does NOT save (the guard blocks it).
  await page.getByTestId('cm-tab-advanced').click()
  await page.getByTestId('cm-json').fill(CONTACTS)
  await page.getByTestId('cm-validate').click()
  await page.getByTestId('cm-preview').waitFor({ state: 'visible', timeout: 10000 })
  await page.getByTestId('cm-merge-save').click()
  await page.waitForTimeout(1000)
  expect(await callReady(page), 'Safari import must NOT persist into this jar').toBe(0)
  await ctx.close()
})

test('canonical installed PWA: no guard, import works and persists across reopen', async ({ browser }) => {
  const ctx = await iosContext(browser, true) // navigator.standalone = true => PWA
  const page = await ctx.newPage()
  await openCM(page)
  await expect(page.getByTestId('container-guard-banner')).toHaveCount(0)
  await expect(page.getByTestId('contacts-receipt')).toContainText('container:CANONICAL_PWA')

  await page.getByTestId('cm-tab-advanced').click()
  await page.getByTestId('cm-json').fill(CONTACTS)
  await page.getByTestId('cm-validate').click()
  await page.getByTestId('cm-preview').waitFor({ state: 'visible', timeout: 10000 })
  await page.getByTestId('cm-merge-save').click()
  await expect.poll(async () => callReady(page), { timeout: 15000 }).toBeGreaterThanOrEqual(2)

  // Reopen a page in the SAME context (same jar) — persists, no re-import.
  const page2 = await ctx.newPage()
  await openCM(page2)
  expect(await callReady(page2), 'canonical PWA import persists across reopen').toBeGreaterThanOrEqual(2)
  await ctx.close()
})
