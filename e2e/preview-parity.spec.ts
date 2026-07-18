/**
 * PREVIEW parity — drives the REAL deployed AbuAI UI on a bilingual (Hebrew +
 * Rioplatense Spanish) turn set and asserts the parity dimensions that the endpoint
 * probes cannot reach: LANGUAGE DISCIPLINE (a Spanish turn is answered in Spanish
 * with NO Hebrew; a Hebrew turn carries no stray Latin), correctness key-facts, and
 * the P2 rambling-create extraction — all on the deployed build, in a real browser.
 *
 *   PREVIEW_URL=https://abu-bank-XXXX.vercel.app npx playwright test \
 *     e2e/preview-parity.spec.ts --project=mobile-chrome
 *
 * These flows are CLIENT-SIDE deterministic (family / dates / calendar CRUD +
 * referability + relation-phrase resolution), so they answer without an LLM — a
 * divergence on the deployed build vs the local CODE runtime is a real bug.
 *
 * Evidence class: PREVIEW (the deployed build answering in a real browser).
 */
import { test, expect, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { APP_VERSION } from '../src/version'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(HERE, '../docs/eval')
const AI_TIMEOUT = 40_000

async function enterAbuAI(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  await page.evaluate(async () => {
    try { localStorage.clear() } catch { /* */ }
    try { await new Promise<void>((res) => { const r = indexedDB.deleteDatabase('abu-durable'); r.onsuccess = () => res(); r.onerror = () => res(); r.onblocked = () => res() }) } catch { /* */ }
  })
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  const ai = page.locator('text=Abu AI').first()
  await ai.waitFor({ state: 'visible', timeout: 15_000 })
  await ai.click()
  await page.locator('textarea[placeholder]').waitFor({ state: 'visible', timeout: 10_000 })
}

async function send(page: Page, text: string): Promise<{ answer: string; latencyMs: number }> {
  const ta = page.locator('textarea[placeholder]')
  await ta.waitFor({ state: 'visible', timeout: 10_000 })
  const before = await page.locator('[data-testid="abuai-msg-assistant"]').count()
  const t0 = Date.now()
  await ta.fill(text)
  await ta.press('Enter')
  await page.waitForFunction(
    (prev) => {
      const els = document.querySelectorAll('[data-testid="abuai-msg-assistant"]')
      if (els.length <= prev) return false
      const raw = els[els.length - 1]?.textContent ?? ''
      if (raw.includes('▍')) return false
      const t = raw.replace(/^\s*אבו AI\s*/, '').replace(/\d{1,2}:\d{2}\s*$/, '').trim()
      return t.length > 1 && !/בודקת|מתמללת|מקשיבה|רגע, בודקת/.test(t.slice(-16))
    },
    before,
    { timeout: AI_TIMEOUT },
  ).catch(() => { /* timeout → capture whatever is there */ })
  await page.waitForTimeout(250)
  const latencyMs = Date.now() - t0
  const raw = await page.evaluate(() => {
    const els = document.querySelectorAll('[data-testid="abuai-msg-assistant"]')
    return els[els.length - 1]?.textContent ?? ''
  })
  const answer = raw.replace(/^\s*אבו AI\s*/, '').replace(/▍/g, '').replace(/\d{1,2}:\d{2}\s*$/, '').trim()
  return { answer, latencyMs }
}

// ── language discipline (mirrors src/eval/parityScorecard.ts) ──
const HE = /[֐-׿]/
// A run of >=2 Latin letters that is NOT the permitted token "Martita".
const STRAY_LATIN = /(?<![A-Za-z])(?!Martita\b)[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/
function langOk(answer: string, lang: 'he' | 'es'): boolean {
  const d = answer.trim()
  if (!d) return false
  if (lang === 'he') return HE.test(d) && !STRAY_LATIN.test(d)
  return /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(d) && !HE.test(d) // a Spanish reply carries no Hebrew
}

const RAMBLE = 'אז תשמעי, דיברתי היום עם החתן של רפי, והוא סיפר לי שהוא טס לניו יורק בשבוע הבא, ואנחנו רוצים להיפגש מחר בשלוש אחר הצהריים בבית קפה טולדנו כדי לדבר על הטיול המשפחתי'

type Turn = { id: string; input: string; lang: 'he' | 'es'; contains?: string[]; absent?: string[] }
// Parity is measured PER FLOW, each in its OWN fresh session — exactly like the CODE
// oracle src/eval/parityScorecard.ts (every ParitySession starts from IDLE_RUNTIME).
// A fresh enterAbuAI() runs between sessions so an unconfirmed draft from one flow can
// never bleed into the next (mixing He + Es in one session is a different, harsher
// scenario — see the contamination note in docs/eval/PREVIEW_PARITY_RESULTS.json usage).
const SESSIONS: Array<{ id: string; turns: Turn[] }> = [
  // Hebrew — relation-between + date arithmetic.
  { id: 'he-knowledge', turns: [
    { id: 'he-fam-between', input: 'מה הקשר בין אנבל ללאו', lang: 'he', contains: ['לאו'] },
    { id: 'he-date-beod', input: 'בעוד 5 ימים איזה יום', lang: 'he', contains: ['2026'] },
  ] },
  // Hebrew — the P2 rambling create (resolves the person, keeps the place, no dump).
  { id: 'he-rambling', turns: [
    { id: 'he-rambling', input: RAMBLE, lang: 'he', contains: ['גלעד', 'טולדנו', 'מחר'], absent: ['ניו יורק', 'סיפר לי'] },
  ] },
  // Rioplatense Spanish — knowledge. Language discipline: NO Hebrew may leak.
  { id: 'es-knowledge', turns: [
    { id: 'es-family', input: '¿qué relación hay entre Anabel y Leo?', lang: 'es', contains: ['Leo'] },
    { id: 'es-math', input: 'cuánto es 12 por 8', lang: 'es', contains: ['96'] },
  ] },
  // Rioplatense Spanish — the full CRUD chain in ONE fresh session (create→confirm→cancel).
  // Every reply must stay in Spanish (the Cycle-41 Spanish-cancel fix, proven on preview).
  { id: 'es-crud', turns: [
    { id: 'es-create', input: 'agendá una reunión con Gabi mañana a las tres', lang: 'es', contains: ['Gabi'] },
    { id: 'es-confirm', input: 'dale, agendalo', lang: 'es', contains: ['Gabi'] },
    { id: 'es-cancel', input: 'cancelalo', lang: 'es', contains: ['Gabi'] },
  ] },
]

test('PREVIEW parity — bilingual language discipline + P2 extraction on the deployed build', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)) })

  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  const badge = page.locator('[data-testid="home-qa-version"]')
  await badge.waitFor({ state: 'visible', timeout: 15_000 })
  const badgeText = (await badge.textContent())?.trim() ?? ''
  const versionOk = badgeText.includes(APP_VERSION.version)

  const results: Array<Record<string, unknown>> = []
  for (const session of SESSIONS) {
    await enterAbuAI(page) // fresh session per flow — matches the CODE oracle's IDLE_RUNTIME
    for (const turn of session.turns) {
      let answer = '', latencyMs = 0, error: string | null = null
      try { const r = await send(page, turn.input); answer = r.answer; latencyMs = r.latencyMs } catch (e) { error = (e as Error).message }
      const missing = (turn.contains ?? []).filter((c) => !answer.includes(c))
      const leaked = (turn.absent ?? []).filter((a) => answer.includes(a))
      const languageOk = langOk(answer, turn.lang)
      const pass = missing.length === 0 && leaked.length === 0 && languageOk && !error
      results.push({ session: session.id, id: turn.id, input: turn.input, lang: turn.lang, answer, latencyMs, languageOk, missing, leaked, pass, error })
    }
  }

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'PREVIEW_PARITY_RESULTS.json'), JSON.stringify({
    version: APP_VERSION.version, versionBadgeOk: versionOk, badgeText,
    previewUrl: process.env.PREVIEW_URL ?? null,
    ran: results.length, passed: results.filter((r) => r.pass).length,
    consoleErrors: consoleErrors.slice(0, 20), results,
  }, null, 2))

  // eslint-disable-next-line no-console
  console.log(`\n[PREVIEW PARITY] version=${versionOk ? 'OK' : 'MISMATCH'} passed=${results.filter(r => r.pass).length}/${results.length}`)
  for (const r of results) {
    // eslint-disable-next-line no-console
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'} [${r.id}] (${r.lang}) ${r.latencyMs}ms langOk=${r.languageOk} :: "${(r.answer as string).slice(0, 64)}"${(r.missing as string[]).length ? ' MISSING=' + (r.missing as string[]).join('|') : ''}${(r.leaked as string[]).length ? ' LEAKED=' + (r.leaked as string[]).join('|') : ''}`)
  }

  expect(versionOk, `version badge "${badgeText}" must contain ${APP_VERSION.version}`).toBe(true)
  const failures = results.filter((r) => !r.pass)
  expect(failures, `parity divergences: ${failures.map(f => f.id).join(', ')}`).toHaveLength(0)
})
