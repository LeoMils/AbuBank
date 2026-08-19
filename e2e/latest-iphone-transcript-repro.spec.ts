/**
 * Latest iPhone transcript REPRODUCTION — MULTI-TURN, against the DEPLOYED runtime.
 * This is the honest test the single-turn simulator was missing: it drives the real
 * deployed AbuAI UI through the exact multi-turn flows Leo hit (create→yes→readback,
 * ask→continue, "do you remember"), keeping ONE session per conversation, and records
 * the ACTUAL on-screen answer + a pass/fail per expectation. Reproduction mode: it does
 * NOT hard-fail — it captures every real failure to docs/eval/LATEST_IPHONE_REPRO_RESULTS.json.
 *
 *   PREVIEW_URL=<deploy> npx playwright test e2e/latest-iphone-transcript-repro.spec.ts --project=mobile-chrome
 */
import { test, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs/eval')
const AI_TIMEOUT = 45_000

async function enterAbuAI(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  const ai = page.locator('text=Abu AI').first()
  await ai.waitFor({ state: 'visible', timeout: 15_000 })
  await ai.click()
  await page.locator('textarea[placeholder]').waitFor({ state: 'visible', timeout: 10_000 })
}

async function clearSession(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.evaluate(() => { try { localStorage.clear() } catch { /* */ } })
}

async function send(page: Page, text: string): Promise<string> {
  const ta = page.locator('textarea[placeholder]')
  await ta.waitFor({ state: 'visible', timeout: 10_000 })
  const before = await page.locator('[data-testid="abuai-msg-assistant"]').count()
  await ta.fill(text)
  await ta.press('Enter')
  await page.waitForFunction((prev) => {
    const els = document.querySelectorAll('[data-testid="abuai-msg-assistant"]')
    if (els.length <= prev) return false
    const raw = els[els.length - 1]?.textContent ?? ''
    if (raw.includes('▍')) return false
    const t = raw.replace(/^\s*אבו AI\s*/, '').replace(/\d{1,2}:\d{2}\s*$/, '').trim()
    return t.length > 1 && !/^[●•·.\s]+$/.test(t) && !/בודקת|מתמללת|מקשיבה|רגע, אני/.test(t.slice(-14))
  }, before, { timeout: AI_TIMEOUT }).catch(() => {})
  await page.waitForTimeout(500)
  const raw = await page.evaluate(() => {
    const els = document.querySelectorAll('[data-testid="abuai-msg-assistant"]')
    return els[els.length - 1]?.textContent ?? ''
  })
  return raw.replace(/^\s*אבו AI\s*/, '').replace(/▍/g, '').replace(/\d{1,2}:\d{2}\s*$/, '').trim()
}

interface Turn { text: string; expect: (a: string, hist: string[]) => string | null } // return failure reason or null
interface Convo { id: string; turns: Turn[] }

const has = (a: string, ...xs: string[]) => xs.some(x => a.includes(x))
const CONVOS: Convo[] = [
  { id: 'calendar-create-confirm-readback', turns: [
    { text: 'תקבעי לי פגישה עם אורית היום בשמונה בערב אצלי בבית', expect: a => has(a, 'אורית') && (has(a, '20') || has(a, 'שמונה')) ? null : `create did not read back person+time: "${a}"` },
    { text: 'כן כן', expect: a => has(a, 'ביטלתי', 'לא הבנתי', 'מה לקבוע') ? `confirm was cancelled/unclear: "${a}"` : (has(a, 'קבעתי', 'נקבע', 'רשמתי', 'שמור', 'סגור', 'נקבעה', 'קבוע') ? null : `confirm did not clearly save: "${a}"`) },
    { text: 'מה יש לי היום', expect: a => has(a, 'אורית') ? null : `saved event not shown in today: "${a}"` },
  ]},
  { id: 'empty-calendar-no-hallucination', turns: [
    { text: 'מה יש לי מחר', expect: a => /רופא|תור|פגישה\s+עם|\d{1,2}:\d{2}/.test(a) ? `invented events on empty calendar: "${a}"` : null },
  ]},
  { id: 'family-relations', turns: [
    { text: 'מי זה לאו', expect: a => has(a, 'לאו', 'בן', 'הבן') ? null : `Leo wrong: "${a}"` },
    { text: 'מי זאת אנאבל', expect: a => has(a, 'אנאבל') && !has(a, 'לא יודעת', 'לא מכירה') ? null : `Anabel wrong/unknown: "${a}"` },
    { text: 'מי זאת ירדן', expect: a => has(a, 'עילי') ? null : `Yarden not linked to Eili: "${a}"` },
    { text: 'מי זה רפי', expect: a => has(a, 'מור') ? null : `Rafi not linked to Mor: "${a}"` },
    { text: 'מי בן הזוג של אופיר', expect: a => has(a, 'גלעד') ? null : `Ofir partner wrong (expect גלעד): "${a}"` },
  ]},
  { id: 'online-questions', turns: [
    { text: 'מה הסרטים בקולנוע היום', expect: a => has(a, 'לא מצליחה לבדוק', 'אין לי גישה', 'לא יכולה') ? `online cinema refused: "${a}"` : null },
    { text: 'מי ניצח במונדיאל', expect: a => a.length > 3 && !has(a, 'לא הבנתי') ? null : `worldcup no answer: "${a}"` },
    { text: 'מתי האוטובוס הבא לתל אביב', expect: a => a.length > 3 ? null : `bus no answer: "${a}"` },
  ]},
  { id: 'continue-and-memory', turns: [
    { text: 'ספרי לי על המהפכה הצרפתית', expect: a => a.length > 10 ? null : `no answer to give: "${a}"` },
    { text: 'תמשיכי', expect: (a, h) => has(a, 'לא מצליחה לבדוק', 'מה היה הנושא', 'לא זוכרת', 'com](', 'cbsnews') ? `continue broke: "${a}"` : (a.length > 5 && a !== h[h.length - 2] ? null : `continue empty/duplicate: "${a}"`) },
    { text: 'על מה דיברנו', expect: a => has(a, 'מהפכה', 'צרפת', 'צרפתית') ? null : `does not remember topic: "${a}"` },
  ]},
  { id: 'repeated-frustration', turns: [
    { text: 'את לא מבינה אותי', expect: a => a.length > 3 ? null : `no response: "${a}"` },
    { text: 'את שוב לא מבינה אותי', expect: (a, h) => a === h[h.length - 2] ? `identical robotic repeat: "${a}"` : null },
  ]},
]

test('reproduce latest iPhone transcript failures on the deployed runtime', async ({ page }) => {
  const results: Array<Record<string, unknown>> = []
  for (const convo of CONVOS) {
    await clearSession(page)
    await enterAbuAI(page)
    const hist: string[] = []
    for (const turn of convo.turns) {
      let answer = '', reason: string | null = 'no answer captured'
      try { answer = await send(page, turn.text); hist.push(answer); reason = turn.expect(answer, hist) } catch (e) { reason = `error: ${(e as Error).message}` }
      results.push({ convo: convo.id, input: turn.text, answer, ok: reason === null, reason })
    }
  }
  const failures = results.filter(r => !r.ok)
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'LATEST_IPHONE_REPRO_RESULTS.json'), JSON.stringify({ total: results.length, failures: failures.length, results }, null, 1))
  // eslint-disable-next-line no-console
  console.log(`[REPRO] ${results.length} turns · ${failures.length} FAILURES`)
  for (const f of failures) console.log(`  ✗ [${f.convo}] "${f.input}" → ${f.reason}`)
  // Reproduction mode: never hard-fail — the JSON + log are the evidence.
})
