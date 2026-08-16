/* First-turn (cold-start) probe — rule out the historical "hangs after the first question" P0. */
import { chromium } from 'playwright'
const RC = process.argv[2]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 412, height: 870 } })
await page.goto(`${RC}/?legacy=1`, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(3000)
const box = page.locator('textarea, input[type="text"]').first()
const before = await page.evaluate(() => document.body.innerText).catch(() => '')
await box.fill('כמה זה שבע כפול שמונה?')
await box.press('Enter').catch(() => {})
let after = before, grew = false
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(1000)
  after = await page.evaluate(() => document.body.innerText).catch(() => after)
  if (after.length > before.length + 8) { grew = true; if (i > 3) break }
}
const delta = after.slice(before.length).replace(/\s+/g, ' ').trim()
console.log('FIRST_TURN_RESPONDED:', grew)
console.log('answer:', (delta || '(none)').slice(0, 300))
await browser.close()
