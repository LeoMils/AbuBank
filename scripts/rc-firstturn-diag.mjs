/* First-turn root-cause diagnostic: does the send register + does /api/abuai-chat fire + errors? */
import { chromium } from 'playwright'
const RC = process.argv[2]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 412, height: 870 } })

const chatRequests = []
const consoleErrors = []
page.on('request', (r) => { if (/\/api\/abuai-(chat|online)/.test(r.url())) chatRequests.push({ t: Date.now(), method: r.method(), url: r.url().replace(RC, '') }) })
page.on('response', (r) => { if (/\/api\/abuai-(chat|online)/.test(r.url())) chatRequests.push({ t: Date.now(), status: r.status(), url: r.url().replace(RC, '') }) })
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`${m.type()}: ${m.text().slice(0, 160)}`) })
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e.message).slice(0, 160)}`))

await page.goto(`${RC}/?legacy=1`, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(3000)
const box = page.locator('textarea, input[type="text"]').first()
const boxCount = await box.count()
await box.fill('כמה זה שבע כפול שמונה?')
const filledValue = await box.inputValue().catch(() => '?')
await box.press('Enter').catch(() => {})
await page.waitForTimeout(2000)
// Did the user message render (send registered)?
const userMsgRendered = await page.evaluate(() => document.body.innerText.includes('שבע כפול שמונה')).catch(() => false)
await page.waitForTimeout(12000)
const bodyAfter = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim()).catch(() => '')
await browser.close()

console.log(JSON.stringify({
  boxFound: boxCount > 0,
  filledOk: filledValue.includes('שבע'),
  userMsgRendered,
  chatApiEvents: chatRequests,
  consoleErrors: consoleErrors.slice(0, 8),
  bodyTail: bodyAfter.slice(-300),
}, null, 2))
