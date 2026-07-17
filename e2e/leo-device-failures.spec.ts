/**
 * LEO DEVICE FAILURES — reproduce at the APP level (deployed preview, real entry path).
 * Governing rule: only preview-through-the-app evidence counts. Lab-green ≠ green.
 *
 *   PREVIEW_URL=https://abu-bank-XXXX.vercel.app npx playwright test \
 *     e2e/leo-device-failures.spec.ts --project=mobile-chrome
 *
 * Records the ACTUAL on-screen answer for each of Leo's reported 0.113.0 failures.
 */
import { test, expect, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(HERE, '../docs/eval')
const AI_TIMEOUT = 45_000

async function enterAbuAI(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.evaluate(async () => {
    try { localStorage.clear() } catch { /* */ }
    try { await new Promise<void>((r) => { const q = indexedDB.deleteDatabase('abu-durable'); q.onsuccess = () => r(); q.onerror = () => r(); q.onblocked = () => r() }) } catch { /* */ }
  })
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  const ai = page.locator('text=Abu AI').first()
  await ai.waitFor({ state: 'visible', timeout: 15_000 })
  await ai.click()
  await page.locator('textarea[placeholder]').waitFor({ state: 'visible', timeout: 10_000 })
}

async function send(page: Page, text: string): Promise<string> {
  const ta = page.locator('textarea[placeholder]')
  const before = await page.locator('[data-testid="abuai-msg-assistant"]').count()
  await ta.fill(text); await ta.press('Enter')
  await page.waitForFunction((prev) => {
    const els = document.querySelectorAll('[data-testid="abuai-msg-assistant"]')
    if (els.length <= prev) return false
    const raw = els[els.length - 1]?.textContent ?? ''
    if (raw.includes('▍')) return false
    const t = raw.replace(/^\s*אבו AI\s*/, '').replace(/\d{1,2}:\d{2}\s*$/, '').trim()
    return t.length > 1 && !/בודקת|מתמללת|מקשיבה/.test(t.slice(-16))
  }, before, { timeout: AI_TIMEOUT }).catch(() => {})
  await page.waitForTimeout(300)
  const raw = await page.evaluate(() => document.querySelectorAll('[data-testid="abuai-msg-assistant"]')[document.querySelectorAll('[data-testid="abuai-msg-assistant"]').length - 1]?.textContent ?? '')
  return raw.replace(/^\s*אבו AI\s*/, '').replace(/▍/g, '').replace(/\d{1,2}:\d{2}\s*$/, '').trim()
}

test('Leo device failures — reproduce at app level', async ({ page }) => {
  const rec: Array<Record<string, unknown>> = []

  // #3 — relation question "מי גלעד עבור רפי" (who is Gilad for Rafi → son-in-law)
  await enterAbuAI(page)
  const rel = await send(page, 'מי גלעד עבור רפי')
  rec.push({ id: 'relation-gilad-rafi', input: 'מי גלעד עבור רפי', answer: rel, resolves: /חתן|גיס|קשר|נשוי|אופיר/.test(rel), deadEnd: /לא יודעת|לא הצלחתי|אין לי/.test(rel) })

  // #1 — create with a RELATION PHRASE as the person ("החתן של רפי" → Gilad). Fresh session.
  await enterAbuAI(page)
  const card = await send(page, 'תקבעי פגישה עם החתן של רפי מחר בשלוש')
  rec.push({ id: 'create-relation-phrase', input: 'תקבעי פגישה עם החתן של רפי מחר בשלוש', answer: card, resolvedToGilad: card.includes('גלעד'), literalPhrase: card.includes('החתן של רפי') })

  // #2 — rambling spoken-style story, FRESH session (no pending draft carryover):
  // place (cafe Toledano / New York), relation phrase, date/time, buried context.
  // Expect a MEANINGFUL title + resolved person + extracted location, correct date.
  await enterAbuAI(page)
  const story = 'אז תשמעי, דיברתי היום עם החתן של רפי, והוא סיפר לי שהוא טס לניו יורק בשבוע הבא, ואנחנו רוצים להיפגש מחר בשלוש אחר הצהריים בבית קפה טולדנו כדי לדבר על הטיול המשפחתי'
  const storyCard = await send(page, story)
  rec.push({ id: 'create-rambling-story', input: story, answer: storyCard, resolvedToGilad: storyCard.includes('גלעד'), literalPhrase: storyCard.includes('החתן של רפי'), hasLocation: /טולדנו|ניו יורק/.test(storyCard), dateTomorrow: storyCard.includes('מחר'), dateToday: storyCard.includes('היום'), verbatimDump: storyCard.includes('אז תשמעי') || storyCard.includes('סיפר לי') })

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'LEO_DEVICE_FAILURES_REPRO.json'), JSON.stringify({ previewUrl: process.env.PREVIEW_URL ?? null, rec }, null, 2))
  // eslint-disable-next-line no-console
  for (const r of rec) console.log(`\n[REPRO ${r.id}]\n  in : ${r.input}\n  out: ${r.answer}\n  flags: ${JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => !['id', 'input', 'answer'].includes(k))))}`)
  expect(rec.length).toBe(3)
})
