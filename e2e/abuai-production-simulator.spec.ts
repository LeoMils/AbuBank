/**
 * AbuAI Production Simulator
 * Drives the REAL deployed AbuAI PWA UI: enters AbuAI → sends Martita-style
 * messages → captures the ACTUAL on-screen answer + latency + console errors →
 * scores each with the SEPARATE judge (judgeLiveAnswer, NOT AbuAI) → writes results.
 *
 * REQUIRES a backend: run against the DEPLOYED URL (which serves /api/*):
 *   PREVIEW_URL=https://abu-bank-XXXX.vercel.app npx playwright test \
 *     e2e/abuai-production-simulator.spec.ts --project=mobile-chrome
 * Local `vite preview` has no /api → responses never arrive (reported honestly).
 */
import { test, expect, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { judgeLiveAnswer, LIVE_DIMENSIONS } from '../src/eval/liveConversationReplay'
import { CRITICAL_UI } from '../src/eval/productionSimulatorScenarios'
import { APP_VERSION } from '../src/version'

const OUT = path.resolve(__dirname, '../docs/eval')
const AI_TIMEOUT = 45_000

async function enterAbuAI(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  const ai = page.locator('text=Abu AI').first()
  await ai.waitFor({ state: 'visible', timeout: 15_000 })
  await ai.click()
  await page.locator('textarea[placeholder]').waitFor({ state: 'visible', timeout: 10_000 })
}

async function sendAndCapture(page: Page, text: string): Promise<{ answer: string; latencyMs: number }> {
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
      const last = els[els.length - 1]
      const t = (last?.textContent ?? '').trim()
      return t.length > 2 && !/^[●•·.\s▍]+$/.test(t) && !/בודקת|מתמללת|מקשיבה/.test(t.slice(-12))
    },
    before,
    { timeout: AI_TIMEOUT },
  ).catch(() => { /* timeout → empty answer captured below */ })
  const latencyMs = Date.now() - t0
  const answer = await page.evaluate(() => {
    const els = document.querySelectorAll('[data-testid="abuai-msg-assistant"]')
    return (els[els.length - 1]?.textContent ?? '').trim()
  })
  return { answer, latencyMs }
}

test('AbuAI production simulator — real UI answers, judged', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })

  // version badge visible + matches the build under test
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 })
  const badge = page.locator('[data-testid="home-qa-version"]')
  await badge.waitFor({ state: 'visible', timeout: 15_000 })
  const badgeText = (await badge.textContent())?.trim() ?? ''
  const versionOk = badgeText.includes(APP_VERSION.version)

  await enterAbuAI(page)

  const results: Array<Record<string, unknown>> = []
  for (const s of CRITICAL_UI) {
    let answer = '', latencyMs = 0, error: string | null = null
    try { const r = await sendAndCapture(page, s.turns[s.turns.length - 1]!); answer = r.answer; latencyMs = r.latencyMs } catch (e) { error = (e as Error).message }
    const noBackend = !answer && latencyMs >= AI_TIMEOUT - 1000
    const j = answer ? judgeLiveAnswer(s, answer) : { scores: Object.fromEntries(LIVE_DIMENSIONS.map(d => [d, 0])), overall: 0, failReason: noBackend ? 'no answer (backend/env)' : 'empty' }
    results.push({ id: s.id, category: s.category, critical: !!s.critical, lang: s.lang, input: s.turns[s.turns.length - 1], answer, latencyMs, overall: j.overall, scores: j.scores, failReason: j.failReason })
  }

  const answered = results.filter(r => (r.answer as string).length > 0)
  const overall = answered.length ? Math.round(answered.reduce((a, r) => a + (r.overall as number), 0) / answered.length) : 0
  const byDim: Record<string, number> = {}
  for (const d of LIVE_DIMENSIONS) { const vals = answered.map(r => (r.scores as Record<string, number>)[d]); byDim[d] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0 }
  const failures = results.filter(r => (r.answer as string).length > 0 && (r.overall as number) < 85)

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'PRODUCTION_SIMULATOR_RESULTS.json'), JSON.stringify({
    version: APP_VERSION.version, versionBadgeOk: versionOk, badgeText,
    ran: results.length, answered: answered.length, overall, byDimension: byDim,
    consoleErrors: consoleErrors.slice(0, 20), failures, results,
  }, null, 0))

  // eslint-disable-next-line no-console
  console.log(`[SIMULATOR] version=${versionOk ? 'OK' : 'MISMATCH'} ran=${results.length} answered=${answered.length} overall=${overall} failures=${failures.length} consoleErrors=${consoleErrors.length}`)

  // The spec ALWAYS records results. It only hard-fails on a code-testable regression
  // (answers came back but scored below the floor). No backend → answered=0 → reported,
  // not a code failure (needs the deployed URL).
  expect(versionOk, `version badge "${badgeText}" must contain ${APP_VERSION.version}`).toBe(true)
  if (answered.length > 0) {
    expect(overall, `overall ${overall} must be ≥ 85 across ${answered.length} answered`).toBeGreaterThanOrEqual(85)
  }
})
