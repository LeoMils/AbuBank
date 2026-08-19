/*
 * RTL direction — the app is Hebrew-first and MUST render right-to-left.
 * ════════════════════════════════════════════════════════════════════
 * Owner spec for the DOM-level RTL mutant in scripts/mutation-harness-e2e.mjs.
 * jsdom cannot prove real layout direction (getComputedStyle('direction') is a
 * BROWSER fact), so this lives in Playwright, not the unit harness. If index.html
 * loses dir="rtl", Hebrew UI reflows LTR — punctuation, icons and the whole hero
 * band land on the wrong side for Martita. This locks it.
 */
import { test, expect } from '@playwright/test'

test('the document renders right-to-left (Hebrew-first)', async ({ page }) => {
  await page.goto('/')
  // The <html> element carries the app-wide direction.
  const htmlDir = await page.evaluate(() => document.documentElement.getAttribute('dir'))
  expect(htmlDir).toBe('rtl')
  // And the browser actually computes RTL on the body (not just the attribute).
  const computed = await page.evaluate(() => getComputedStyle(document.body).direction)
  expect(computed).toBe('rtl')
})
