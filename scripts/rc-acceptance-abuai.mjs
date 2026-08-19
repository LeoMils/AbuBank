/*
 * rc-acceptance-abuai.mjs — DEPLOYED conversation-level acceptance for AbuAI text chat. (§16)
 *   node scripts/rc-acceptance-abuai.mjs <rcUrl>
 * Drives the REAL deployed AbuAI legacy text chat (?legacy=1) through a multi-turn, STATEFUL arc
 * and captures the ACTUAL rendered assistant responses (real gpt-4o via the deployed server proxy
 * with the NEW OPENAI_API_KEY + the real AbuAI persona/tools/family data). The transcript is
 * emitted for HUMAN evaluation — PASS is judged from the real answer, never from HTTP completion.
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RC = process.argv[2]
if (!RC) { console.error('usage: node scripts/rc-acceptance-abuai.mjs <rcUrl>'); process.exit(2) }

// A stateful, cross-topic arc. `check` describes what a CORRECT answer must contain (for evaluation).
const TURNS = [
  { id: 'general-math', text: 'כמה זה שבע כפול שמונה?', check: 'must say 56 / חמישים ושש' },
  { id: 'general-knowledge', text: 'מה הבירה של צרפת?', check: 'must say Paris / פריז' },
  { id: 'family-who', text: 'מי זה מור?', check: 'must use family data; Mor is a real family member; no fabrication' },
  { id: 'stateful-followup', text: 'בת כמה היא?', check: 'must resolve "היא"→Mor from prior turn OR honestly say it does not know her age; NEVER invent an age' },
  { id: 'calendar-read', text: 'מה יש לי מחר ביומן?', check: 'must read the calendar tool; if empty say so; never invent an event' },
]

async function lastAssistantText(page, priorCount) {
  // Capture message bubbles; return the newest assistant text beyond priorCount.
  return page.evaluate((prior) => {
    const nodes = Array.from(document.querySelectorAll('[class*="message"], [class*="bubble"], [data-role], li, p, div'))
      .map((n) => (n.textContent || '').trim())
      .filter((t) => t.length > 1)
    return { count: nodes.length, tailText: nodes.slice(-6).join(' | ').slice(0, 800) }
  }, priorCount)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 412, height: 870 } })
await page.goto(`${RC}/?legacy=1`, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(2500)

const box = page.locator('textarea, input[type="text"]').first()
const transcript = []
for (const turn of TURNS) {
  const before = await page.evaluate(() => document.body.innerText).catch(() => '')
  try {
    await box.fill(turn.text)
    await box.press('Enter').catch(() => {})
    const sendBtn = page.locator('button:has-text("שלח"), button[aria-label*="שלח"], button[type="submit"]').first()
    if (await sendBtn.count().then((c) => c > 0)) await sendBtn.click().catch(() => {})
  } catch (e) { transcript.push({ turn: turn.id, user: turn.text, error: `drive: ${String(e.message || e).slice(0, 100)}` }); continue }

  // Wait for a new response (poll the body text for growth), up to ~25s.
  let after = before, grew = false
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000)
    after = await page.evaluate(() => document.body.innerText).catch(() => after)
    if (after.length > before.length + 8) { grew = true; if (i > 2) break } // let streaming finish
  }
  const delta = after.slice(before.length).replace(/\s+/g, ' ').trim()
  transcript.push({ turn: turn.id, user: turn.text, check: turn.check, assistant: (delta || '(no new text captured)').slice(0, 600), responded: grew })
  await page.waitForTimeout(800)
}
await browser.close()

const out = { rc: RC, surface: 'AbuAI legacy text chat (deployed, real gpt-4o via server proxy)', evaluatedBy: 'HUMAN — read assistant text vs check', turns: transcript }
writeFileSync(resolve(process.cwd(), 'docs/engineering-os/qa/rc-acceptance-abuai.json'), JSON.stringify(out, null, 2) + '\n')
for (const t of transcript) {
  console.log(`\n▶ ${t.turn} — user: ${t.user}`)
  console.log(`   check: ${t.check ?? ''}`)
  console.log(`   assistant: ${t.assistant ?? t.error ?? ''}`)
}
console.log('\n→ wrote docs/engineering-os/qa/rc-acceptance-abuai.json')
