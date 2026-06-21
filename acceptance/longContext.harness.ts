/*
 * 20-turn long-context DETERMINISTIC continuity harness.
 *
 * Runs one 20-turn conversation through the real runtime engines (planner →
 * suppression → grounding → continuity rewrite → composer) and asserts the
 * structural properties of a coherent long conversation WITHOUT a live model:
 *   - the thread holds (pronoun/topic continuity resolves to the right person)
 *   - emotional suppression fires and STAYS (mood stickiness)
 *   - no grounded answer repeats verbatim
 *   - no turn leaks raw/banned output
 * Live-model PROSE coherence is a separate BLOCKED_BY_KEYS gate.
 *
 * Run: npx tsx acceptance/longContext.harness.ts
 */
import { writeFileSync } from 'fs'
import { resolve } from 'path'
const g = globalThis as unknown as { localStorage?: Storage }
if (typeof g.localStorage === 'undefined') { const m = new Map<string, string>(); g.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage }

import { planCompanionTurn, deriveStateFromMessages } from '../src/screens/AbuAI/companionPlanner'
import { enforceCompanion, findBannedPhrase } from '../src/screens/AbuAI/companionComposer'
import { tryGroundedAnswer } from '../src/screens/AbuAI/service'
import { saveAppointments } from '../src/screens/AbuCalendar/service'

const now = new Date(); const tmr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
const tISO = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`
saveAppointments([{ id: 's1', title: 'רופא', date: tISO, time: '16:00', emoji: '🏥', color: '#C9A84C' }] as never)

const DIRECT_Q = /^מי |^מתי |^איפה |^כמה |^מה זה |^מה זאת |[?؟]$/
interface Msg { role: 'user' | 'assistant'; content: string }
const RAW = /[{[]"?\w+"?\s*:/

interface Turn { in: string; expect?: { person?: string; suppress?: boolean; truthHas?: string } }
const CONVO: Turn[] = [
  { in: 'בוקר טוב' },
  { in: 'מי זאת מור?', expect: { person: 'מור', truthHas: 'מור' } },
  { in: 'ספרי לי עליה', expect: { person: 'מור', truthHas: 'מור' } },
  { in: 'ועוד?', expect: { person: 'מור' } },
  { in: 'מי דוד של אופיר?', expect: { truthHas: 'לאו' } },
  { in: 'מה יש לי מחר?', expect: { truthHas: 'רופא' } },
  { in: 'מה יש לי מחר בארבע?', expect: { truthHas: 'רופא' } },
  { in: 'תקבעי מחר בשלוש עם מוטי' },
  { in: 'אני מתגעגעת לפאפי', expect: { suppress: true } },
  { in: 'הוא תמיד היה שר בבוקר', expect: { suppress: true } },
  { in: 'מה השעה?', expect: { suppress: true } },           // stickiness
  { in: 'מי זאת יעל?', expect: { person: 'יעל', truthHas: 'יעל' } },
  { in: 'ספרי לי עליה', expect: { person: 'יעל', truthHas: 'יעל' } },
  { in: 'משעמם לי', expect: { suppress: true } },
  { in: 'מי סבתא רבתא של אנאבל?', expect: { truthHas: 'מרטיטה' } },
  { in: 'מה חדש בעולם?' },
  { in: 'תחזרי למור', expect: { truthHas: 'מור' } },
  { in: 'מי דודה של עדי?', expect: { truthHas: 'מור' } },
  { in: 'תזכירי לי לקחת כדור בשמונה' },
  { in: 'תודה' },
]

function runTurn(msg: string, history: Msg[]): { response: string; suppress: boolean; truth: string } {
  const plan = planCompanionTurn(msg, deriveStateFromMessages(history))
  let eff = msg
  const backTo = msg.match(/(?:תחזרי|נחזור|חזרה)\s+ל([֐-׿]{2,})/)
  if (backTo && !plan.suppressLookups) eff = `ספרי לי על ${backTo[1]}`
  else if (plan.step4_continuity.continuesTopic && plan.step4_continuity.resolvedPerson && !plan.step3_familyEntity && !plan.suppressLookups && plan.step5_calendar === 'none' && !plan.step6_onlineNeeded) eff = `ספרי לי על ${plan.step4_continuity.resolvedPerson}`
  const skip = plan.suppressLookups && !DIRECT_Q.test(eff.trim())
  let grounded: string | null = null
  try { grounded = skip ? null : tryGroundedAnswer(eff) } catch { grounded = null }
  const resp = enforceCompanion(grounded ?? 'בטח, נדבר על זה.', plan)
  return { response: resp, suppress: plan.suppressLookups, truth: grounded ?? '-' }
}

const history: Msg[] = []
const fails: string[] = []
const seen = new Set<string>()
const transcript: string[] = []
CONVO.forEach((t, i) => {
  const plan = planCompanionTurn(t.in, deriveStateFromMessages(history))
  const out = runTurn(t.in, history)
  transcript.push(`${i + 1}. M: ${t.in}\n   A: ${out.response}  <sub>suppress=${out.suppress} truth=${out.truth}</sub>`)
  // universal: no raw/banned
  if (findBannedPhrase(out.response)) fails.push(`#${i + 1} banned register`)
  if (RAW.test(out.response)) fails.push(`#${i + 1} raw output`)
  // no repeat among DISTINCT family-identity/inference answers (continuation
  // turns "ועוד?"/pronoun and same-single-event calendar legitimately repeat
  // without an LLM to vary the wording — exempt them).
  const isContOrCal = /ועוד|תמשיכי|עליה|עליו|מה יש לי|תזכירי|תקבעי/.test(t.in)
  if (out.truth !== '-' && !isContOrCal) { if (seen.has(out.response)) fails.push(`#${i + 1} repeated answer`); seen.add(out.response) }
  // expectations
  const e = t.expect
  if (e?.person && plan.step4_continuity.resolvedPerson !== e.person && !out.truth.includes(e.person)) fails.push(`#${i + 1} person ${plan.step4_continuity.resolvedPerson}≠${e.person}`)
  if (e?.suppress !== undefined && out.suppress !== e.suppress) fails.push(`#${i + 1} suppress ${out.suppress}≠${e.suppress}`)
  if (e?.truthHas && !out.truth.includes(e.truthHas) && !out.response.includes(e.truthHas)) fails.push(`#${i + 1} truth missing ${e.truthHas}`)
  history.push({ role: 'user', content: t.in }); history.push({ role: 'assistant', content: out.response })
})

const md = ['# LONG-CONTEXT (20-turn) DETERMINISTIC TRANSCRIPT', '', `turns:${CONVO.length} · failures:${fails.length}`, '', ...transcript, '', fails.length ? '## FAILURES\n' + fails.map(f => '- ' + f).join('\n') : '## ALL CONTINUITY/SUPPRESSION/NO-REPEAT CHECKS PASS']
writeFileSync(resolve(process.cwd(), 'docs/abuai/LONG_CONTEXT_TRANSCRIPT.md'), md.join('\n'), 'utf-8')
console.log(`LONG-CONTEXT HARNESS  turns:${CONVO.length} failures:${fails.length}`)
for (const f of fails) console.log('  ' + f)
process.exitCode = fails.length ? 1 : 0
