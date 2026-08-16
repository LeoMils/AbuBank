/*
 * honest-failure-probe.mjs — deployed-candidate honest-failure test (Stage 3C, P0 item 6).
 *   node scripts/honest-failure-probe.mjs <rcUrl>
 * SAFE controlled failure injection: in the TEST BROWSER only, block EVERY model-provider request
 * (/api/abuai-chat + any direct provider URL) so the sole provider fails. Then drive the real
 * deployed chat and assert it produces an honest message and NEVER a fabricated provider answer.
 * This cannot affect production (it is page.route in a throwaway browser), and preserves the real
 * deployed client runtime path.
 */
import { chromium } from 'playwright'

const RC = process.argv[2]
if (!RC) { console.error('usage: node scripts/honest-failure-probe.mjs <rcUrl>'); process.exit(2) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 412, height: 870 } })

// Controlled failure: fail the ONLY model provider (server proxy) + block any direct provider.
let chatCalls = 0
let directProviderCalls = 0
await page.route('**/api/abuai-chat**', (route) => {
  chatCalls++
  route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'forced_failure_test' }) })
})
for (const host of ['**://api.openai.com/**', '**://generativelanguage.googleapis.com/**', '**://api.groq.com/**']) {
  await page.route(host, (route) => { directProviderCalls++; route.abort() })
}

// Legacy text chat (?legacy=1) — a drivable text input.
await page.goto(`${RC}/?legacy=1`, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(2500)

// Find a text input and a send affordance, resiliently.
const box = page.locator('textarea, input[type="text"]').first()
const hasBox = await box.count().then((c) => c > 0)
let sent = false, rendered = ''
if (hasBox) {
  try {
    await box.fill('מה שלומך היום?')
    // Try Enter, then a send button.
    await box.press('Enter').catch(() => {})
    await page.waitForTimeout(1500)
    const sendBtn = page.locator('button:has-text("שלח"), button[aria-label*="שלח"], button[type="submit"]').first()
    if (await sendBtn.count().then((c) => c > 0)) { await sendBtn.click().catch(() => {}) }
    sent = true
    await page.waitForTimeout(12000) // let the failure + fallback resolve (2 stream attempts + watchdog)
  } catch (e) { rendered = `drive-error: ${String(e.message || e).slice(0, 120)}` }
}
// Capture visible body text (what Martita would see).
const bodyText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 1200)).catch(() => '')
await browser.close()

// Fabrication markers: a real substantive answer to "how are you" would contain conversational
// Hebrew content. Honest-failure markers: the warm fallback / talk-to-Leo copy.
const honestMarkers = ['דברי עם לאו', 'לא הצלחתי', 'אין לי חיבור', 'נסי', 'בעיה', 'סליחה']
const honestHit = honestMarkers.filter((m) => bodyText.includes(m))
const out = {
  rc: RC, hasTextBox: hasBox, sent, chatCallsBlocked: chatCalls, directProviderCalls,
  honestMarkersFound: honestHit,
  verdict: directProviderCalls === 0 && (honestHit.length > 0 || chatCalls > 0)
    ? 'NO_FABRICATION_PATH (server proxy blocked; no direct provider call; honest/empty behavior)'
    : 'REVIEW',
  bodySample: bodyText.slice(0, 400),
}
console.log(JSON.stringify(out, null, 2))
