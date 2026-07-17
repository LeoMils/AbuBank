/**
 * PREVIEW typed-script verification — drives the REAL deployed AbuAI UI and asserts
 * the exact answers from docs/LEO_TYPED_TEST_SCRIPT.md. Deterministic checks
 * (family / dates / memory / calendar CRUD referability) run CLIENT-SIDE, so they
 * need no LLM. Any divergence from the local runtime capture is a real bug.
 *
 *   PREVIEW_URL=https://abu-bank-XXXX.vercel.app npx playwright test \
 *     e2e/preview-typed-script.spec.ts --project=mobile-chrome
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
  // Clean slate: clear the durable store so the calendar/memory flow is isolated.
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

// [id, input, expected substrings (ALL must appear), critical?]
const CHECKS: Array<[string, string, string[], boolean]> = [
  ['fam-mor', 'מי זאת מור', ['מרטיטה', 'מור'], true],
  ['fam-inlaw-yarden-noam', 'מה הקשר בין ירדן לנועם', ['עילי', 'דוד'], true],
  ['fam-inlaw-gilad-leo', 'מה הקשר בין גלעד ללאו', ['אופיר'], true],
  ['fam-count', 'כמה נכדים יש למור', ['אנאבל', 'ארי'], true],
  ['date-today', 'מה התאריך היום', ['2026'], true],
  ['date-tomorrow', 'איזה יום מחר', ['2026'], true],
  ['mem-save', 'תזכרי שאני אוהבת יין אדום', ['יין אדום'], true],
  ['mem-recall', 'מה את זוכרת עליי', ['יין אדום'], true],
  ['mem-forget', 'תשכחי שאני אוהבת יין אדום', ['שכחתי'], true],
  ['cal-create', 'תקבעי פגישה עם רפי מחר בשלוש בבית קפה מרוקו', ['רפי', 'נכון'], true],
  ['cal-confirm', 'כן', ['קבוע', 'רפי'], true],
  ['cal-referable-where', 'איפה אני פוגשת אותו?', ['מרוקו'], true],   // 0.112.0 cutover
  ['cal-referable-cancel', 'תבטלי אותה', ['מחקתי'], true],            // 0.112.0 cutover
]

test('PREVIEW typed-script — deterministic checks on the deployed build', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (m) => {
    const t = m.text()
    if (t.includes('[COGDBG]')) { /* eslint-disable-next-line no-console */ console.log(t.slice(0, 240)) }
    if (m.type() === 'error') consoleErrors.push(t.slice(0, 160))
  })

  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  const badge = page.locator('[data-testid="home-qa-version"]')
  await badge.waitFor({ state: 'visible', timeout: 15_000 })
  const badgeText = (await badge.textContent())?.trim() ?? ''
  const versionOk = badgeText.includes(APP_VERSION.version)

  await enterAbuAI(page)

  const results: Array<Record<string, unknown>> = []
  for (const [id, input, expected, critical] of CHECKS) {
    let answer = '', latencyMs = 0, error: string | null = null
    try { const r = await send(page, input); answer = r.answer; latencyMs = r.latencyMs } catch (e) { error = (e as Error).message }
    const missing = expected.filter((e) => !answer.includes(e))
    results.push({ id, input, expected, answer, latencyMs, pass: missing.length === 0, missing, critical, error })
  }

  const failures = results.filter((r) => r.critical && !r.pass)
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'PREVIEW_TYPED_SCRIPT_RESULTS.json'), JSON.stringify({
    version: APP_VERSION.version, versionBadgeOk: versionOk, badgeText,
    previewUrl: process.env.PREVIEW_URL ?? null,
    ran: results.length, passed: results.filter((r) => r.pass).length,
    consoleErrors: consoleErrors.slice(0, 20), results,
  }, null, 2))

  // eslint-disable-next-line no-console
  console.log(`\n[PREVIEW] version=${versionOk ? 'OK' : 'MISMATCH'} passed=${results.filter(r => r.pass).length}/${results.length} critFail=${failures.length}`)
  for (const r of results) {
    // eslint-disable-next-line no-console
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'} [${r.id}] ${r.latencyMs}ms :: "${(r.answer as string).slice(0, 70)}"${(r.missing as string[]).length ? '  MISSING=' + (r.missing as string[]).join('|') : ''}`)
  }

  expect(versionOk, `version badge "${badgeText}" must contain ${APP_VERSION.version}`).toBe(true)
  expect(failures, `critical divergences: ${failures.map(f => f.id).join(', ')}`).toHaveLength(0)
})
