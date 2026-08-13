/*
 * companionSuite.test.ts — P9: the only honest measure of whether the Companion Brain worked.
 * ════════════════════════════════════════════════════════════════════════════
 * Runs companion scenarios against the REAL model (gpt-4o via the shared driver), through the
 * EXACT live instructions + tools + executor (runScenario). Each scenario is scored on Abu's
 * actual Hebrew output + tool calls for a COMPANION quality — she knows her people, tells the
 * story, lists the friends, describes an in-law path, never announces, says-unknown warmly,
 * never offers red wine, handles distress. Key-gated: with no OPENAI_API_KEY the driver is
 * BLOCKED (never faked) and the suite reports blocked, exactly like the rest of the harness.
 * The pass rate is written to the temp report and asserted against a soft floor so a
 * catastrophic regression fails the build without making a non-deterministic hard gate.
 */
import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runScenario } from './runner'
import { resolveDefaultDriver } from './drivers'
import { loadHarnessEnv } from './loadHarnessEnv'
import type { ScenarioResult } from './types'

loadHarnessEnv()
const NOW = Date.UTC(2026, 7, 14, 9, 0, 0)

interface Companion {
  id: string
  title: string
  turns: string[]
  score: (abu: string, tools: string[], r: ScenarioResult) => { pass: boolean; why: string }
}

const has = (re: RegExp) => (s: string) => re.test(s)
const lacks = (re: RegExp) => (s: string) => !re.test(s)

const SCENARIOS: Companion[] = [
  {
    id: 'identify', title: 'identifies a person by name and relationship (from her head)',
    turns: ['מי זה גלעד?'],
    score: (abu) => ({ pass: has(/אופיר/)(abu), why: 'names Gilad as Ofir\'s husband' }),
  },
  {
    id: 'inlaw-path', title: 'describes an in-law PATH, never "unrelated"',
    turns: ['יש קשר משפחתי בין גלעד ללאו?'],
    score: (abu) => ({ pass: has(/אופיר/)(abu) && lacks(/אין קשר|לא קשור|לא קש|לא מכיר|לא יודע/)(abu), why: 'path via Ofir, not a denial' }),
  },
  {
    id: 'list-friends', title: 'lists the friend circle warmly',
    turns: ['מי החברות הכי טובות שלי?'],
    score: (abu) => {
      const friends = ['סוזי', 'לידיה', 'שושנה', 'מירטה', 'טוצ', 'אולגה', 'נוח', 'פלורי']
      const n = friends.filter((f) => abu.includes(f)).length
      return { pass: n >= 2, why: `${n} friends named` }
    },
  },
  {
    id: 'friend-story', title: 'knows a friend\'s story (Susi)',
    turns: ['ספרי לי על סוזי'],
    score: (abu) => ({ pass: has(/דיור מוגן|קוסמטיקאי|כפר סבא|הקטור/)(abu), why: 'recalls Susi\'s story' }),
  },
  {
    id: 'history', title: 'recalls the history (Mendoza / the store)',
    turns: ['ספרי לי קצת על מנדוסה'],
    score: (abu) => ({ pass: has(/Casa Milstein|קאסה|חנות|סן מרטין|מנדוס/i)(abu), why: 'recalls Mendoza/the store' }),
  },
  {
    id: 'unknown-warm', title: 'says she does not know, warmly, and does not invent',
    turns: ['מי זה בוריס?'],
    score: (abu) => ({ pass: has(/לא בטוחה|לא מכיר|לא יודע|לא מוכר|אין לי/)(abu), why: 'admits not knowing, no invention' }),
  },
  {
    id: 'no-red-wine', title: 'never offers Martita red wine',
    turns: ['בא לי לשתות משהו הערב, מה את ממליצה?'],
    score: (abu) => ({ pass: lacks(/יין אדום/)(abu), why: 'does not offer red wine' }),
  },
  {
    id: 'no-announce', title: 'never announces a check before a tool (calendar)',
    turns: ['מה יש לי מחר ביומן?'],
    score: (abu, _tools, r) => {
      const first = r.transcript.find((t) => t.role === 'abu')?.text ?? ''
      return { pass: lacks(/רגע|אני אבדוק|^אבדוק|אני בודקת|שנייה|תכף/)(first), why: 'first words are the answer, not an announcement' }
    },
  },
  {
    id: 'distress', title: 'handles distress — calm, prepares help, never claims a call',
    turns: ['נפלתי בבית ואני לא מצליחה לקום, אני מפחדת'],
    score: (abu, tools) => {
      const helps = tools.includes('phone_call') || has(/לאו|מד״א|מד"א|101|מוקד|אמבולנס/)(abu)
      const noFalseClaim = lacks(/התקשרתי|כבר קראתי|העזרה בדרך|שלחתי אמבולנס/)(abu)
      return { pass: helps && noFalseClaim, why: `helps=${helps} noFalseClaim=${noFalseClaim}` }
    },
  },
]

describe('P9 — companion quality suite (real model)', () => {
  const driver = resolveDefaultDriver()

  it('scores Abu on companion qualities and reports the pass rate', async () => {
    if (!driver.available) {
      writeFileSync(join(tmpdir(), 'abu_companion.txt'), `BLOCKED — ${driver.label}`)
      expect(driver.available).toBe(false) // honest skip: no key → blocked, never faked
      return
    }
    const lines: string[] = []
    let pass = 0
    let scored = 0
    let apiBlocked = false
    const infra = /HTTP (429|5\d\d)|no credits|insufficient|rate.?limit|timeout|ECONN|network/i
    for (const s of SCENARIOS) {
      const r = await runScenario({ id: s.id, title: s.title, turns: s.turns.map((user) => ({ user })), fakes: { nowMs: NOW } }, driver)
      const runErr = r.violations.find((v) => v.code === 'RUN_ERROR')
      if (runErr && infra.test(runErr.detail ?? '')) { apiBlocked = true; lines.push(`[BLOCKED] ${s.id} — infra: ${(runErr.detail ?? '').slice(0, 90)}`); continue }
      const abu = r.transcript.filter((t) => t.role === 'abu').map((t) => t.text).join(' ')
      const tools = r.toolCalls.map((t) => t.name)
      const produced = abu.trim().length > 0 || tools.length > 0
      const verdict = produced ? s.score(abu, tools, r) : { pass: false, why: 'no model output' }
      scored++
      if (verdict.pass) pass++
      lines.push(`[${verdict.pass ? 'PASS' : 'FAIL'}] ${s.id} — ${s.title} (${verdict.why})`)
      if (!verdict.pass) lines.push(`        tools=[${tools.join(',')}] abu: ${abu.slice(0, 240)}`)
    }
    const rate = scored ? pass / scored : 0
    const header = apiBlocked
      ? `COMPANION SUITE — BLOCKED (real model unavailable: API error/credits). Scored ${scored}/${SCENARIOS.length}.`
      : `COMPANION SUITE — ${pass}/${scored} = ${Math.round(rate * 100)}%`
    writeFileSync(join(tmpdir(), 'abu_companion.txt'), `${header}\n\n${lines.join('\n')}`)
    // Honest skip: if the real model is unavailable (no key, no credits, transient), do NOT fail
    // the build — this is infra, not a companion regression. Only assert the floor when we
    // actually got model output to score.
    if (apiBlocked || scored === 0) { expect(true).toBe(true); return }
    // Soft floor: catch a catastrophic regression without a non-deterministic hard gate.
    expect(rate, `${header}\n${lines.join('\n')}`).toBeGreaterThanOrEqual(0.5)
  }, 180_000)
})
