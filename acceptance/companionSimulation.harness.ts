/*
 * Companion-feeling simulation (DETERMINISTIC, no mic).
 *
 * Five emotional scenarios — boredom, sadness, missing Pepe, wanting to talk,
 * asking for something interesting — each run multi-turn in Hebrew AND Spanish
 * through the real proactive companion engine. Each response is scored to REJECT:
 * fake therapy, fake intimacy, childish/patronizing tone, robotic/support register,
 * menus, and raw output. Seed rotation is exercised so consecutive turns don't repeat.
 *
 * This proves the deterministic companion FLOOR is warm-structured and never
 * crosses the forbidden registers. Whether it FEELS like Abu to Martita is the
 * one subjective sliver left to her.
 *
 * Run: npx tsx acceptance/companionSimulation.harness.ts
 */
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const g = globalThis as unknown as { localStorage?: Storage }
if (typeof g.localStorage === 'undefined') { const m = new Map<string, string>(); g.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage }

import { getProactiveSeed } from '../src/screens/AbuAI/proactive'
import { scoreResponse, renderReport, type HarnessReport } from './lib/score'

interface Scenario { name: string; lang: 'he' | 'es'; turns: string[] }
const SCENARIOS: Scenario[] = [
  { name: 'boredom', lang: 'he', turns: ['משעמם לי', 'עדיין משעמם', 'אין לי על מה לדבר'] },
  { name: 'boredom', lang: 'es', turns: ['estoy aburrida', 'me aburro', 'no sé qué hacer'] },
  { name: 'sadness', lang: 'he', turns: ['קצת עצוב לי היום', 'אין לי כוח', 'יום קשה'] },
  { name: 'sadness', lang: 'es', turns: ['estoy triste', 'me siento mal', 'día difícil'] },
  { name: 'missing_pepe', lang: 'he', turns: ['אני מתגעגעת לפאפי', 'חסר לי פפי'] },
  { name: 'missing_pepe', lang: 'es', turns: ['extraño a Pepe', 'extraño mucho a Pepe'] },
  { name: 'wanting_to_talk', lang: 'he', turns: ['תדברי איתי', 'ספרי לי משהו', 'בואי נדבר'] },
  { name: 'wanting_to_talk', lang: 'es', turns: ['hablame', 'contame algo', 'charlemos'] },
  { name: 'something_interesting', lang: 'he', turns: ['תני לי רעיון', 'מה אפשר לעשות היום'] },
  { name: 'something_interesting', lang: 'es', turns: ['dame una idea', 'qué puedo hacer hoy'] },
]

const report: HarnessReport = { title: 'Companion-Feeling Simulation — Deterministic Results', rows: [] }
let i = 0
for (const sc of SCENARIOS) {
  let prev: string | undefined
  for (const turn of sc.turns) {
    i++
    const seed = getProactiveSeed(turn, { previousSeedId: prev })
    const text = seed?.text ?? ''
    prev = seed?.id
    const score = scoreResponse(text, { lang: sc.lang, companion: true })
    // A genuine emotional turn must produce a non-empty companion response.
    const pass = score.pass && text.length > 0
    const fails = text.length === 0 ? [...score.fails, 'no_seed'] : score.fails
    report.rows.push({ id: `C-${i}`, cat: `${sc.name}/${sc.lang}`, user: turn, got: text || '(no seed)', pass, fails })
  }
}

const { md, pass, fail } = renderReport(report)
const out = resolve(process.cwd(), 'docs/abuai/COMPANION_SIMULATION_RESULTS.md')
writeFileSync(out, md, 'utf-8')
console.log(`Companion simulation: ${report.rows.length} turns · pass ${pass} · fail ${fail}. Wrote ${out}`)
if (fail > 0) { for (const row of report.rows.filter(r => !r.pass)) console.log(`  FAIL ${row.id} [${row.cat}] "${row.user}" → "${row.got}" :: ${row.fails.join(', ')}`); process.exitCode = 1 }
