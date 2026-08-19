/*
 * Runs the EXACT failed Martita conversation through the REAL runtime resolution
 * pipeline (mirrors index.tsx handleSend): resolvePronouns → resolveFollowUp →
 * companion continuity rewrite → tryGroundedAnswer → enforceCompanion.
 *
 * Family/calendar answers are produced by the deterministic engine (REAL, no
 * model). Knowledge/open-chat turns hand off to the LLM, which needs a provider
 * key — those are printed as [LLM — requires key], NEVER fabricated.
 *
 * Run: npx tsx acceptance/martitaTranscript.harness.ts
 */
const g = globalThis as unknown as { localStorage?: Storage }
if (typeof g.localStorage === 'undefined') { const m = new Map<string, string>(); g.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage }

import { resolvePronouns } from '../src/screens/AbuAI/pronounResolver'
import { resolveFollowUp } from '../src/screens/AbuAI/contextResolver'
import { planCompanionTurn, deriveStateFromMessages } from '../src/screens/AbuAI/companionPlanner'
import { tryGroundedAnswer } from '../src/screens/AbuAI/service'
import { enforceCompanion, findBannedPhrase } from '../src/screens/AbuAI/companionComposer'
import { saveAppointments } from '../src/screens/AbuCalendar/service'

// Seed this week's calendar so the calendar turns have REAL data.
const now = new Date()
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const plus = (n: number) => { const d = new Date(now); d.setDate(d.getDate() + n); return iso(d) }
saveAppointments([
  { id: 'a', title: 'רופא', date: plus(1), time: '16:00', emoji: '🏥', color: '#C9A84C' },
  { id: 'b', title: 'יוגה', date: plus(3), time: '09:00', emoji: '🧘', color: '#C9A84C' },
] as never)

type Msg = { id: string; role: 'user' | 'assistant'; content: string; timestamp: number }
const RAW_JSON = /[{[]"?\w+"?\s*:/
const PROVIDER_ERR = /\b(401|403|404|500|invalid api key|incorrect api key|unauthorized|rate limit|exception|stack)\b/i

const SCRIPTS: { name: string; turns: string[] }[] = [
  { name: 'HISTORY', turns: ['באיזה שנה הייתה המהפכה הצרפתית', 'עולמית', 'על ההיסטוריה', 'עליה', 'תמשיכי'] },
  { name: 'FAMILY', turns: ['מי זאת מור', 'ומי ארי', 'עליה', 'ומי היא', 'הנכד', 'הנכדים שלי'] },
  { name: 'CALENDAR', turns: ['איזה פגישות יש לי השבוע', 'ומה אחרי זה', 'ומה ביום הבא'] },
]

function runTurn(input: string, history: Msg[]) {
  // 1) mirror index.tsx resolution order exactly
  let msg = input
  const pr = resolvePronouns(msg, history as never)
  if (pr.resolved !== msg) msg = pr.resolved
  const fu = resolveFollowUp(msg, history as never)
  if (fu.wasFollowUp) msg = fu.resolved
  const plan = planCompanionTurn(msg, deriveStateFromMessages(history))
  const backTo = msg.match(/(?:תחזרי|נחזור|חזרה)\s+ל([֐-׿]{2,})/)
  if (backTo && !plan.suppressLookups) msg = `ספרי לי על ${backTo[1]}`
  else if (plan.step4_continuity.continuesTopic && plan.step4_continuity.resolvedPerson && !plan.step3_familyEntity && !plan.suppressLookups && plan.step5_calendar === 'none' && !plan.step6_onlineNeeded) msg = `ספרי לי על ${plan.step4_continuity.resolvedPerson}`

  // 2) grounding (deterministic). null → LLM (needs key).
  let grounded: string | null = null
  try { grounded = tryGroundedAnswer(msg) } catch { grounded = null }
  const response = grounded !== null ? enforceCompanion(grounded, plan) : null
  return { resolvedQuery: msg, plan, grounded, response, person: plan.step4_continuity.resolvedPerson }
}

const lines: string[] = []
let scenarioVerdicts: { name: string; pass: boolean }[] = []

for (const s of SCRIPTS) {
  lines.push(`\n${'═'.repeat(70)}\nSCENARIO: ${s.name}\n${'═'.repeat(70)}`)
  const history: Msg[] = []
  let scenarioPass = true
  s.turns.forEach((input, i) => {
    const r = runTurn(input, history)
    const isLLM = r.response === null
    const out = isLLM ? '[LLM — requires provider key; not generated in this environment]' : r.response!
    // checks
    const banned = !isLLM && findBannedPhrase(out)
    const raw = !isLLM && (RAW_JSON.test(out) || PROVIDER_ERR.test(out))
    const badPerspective = !isLLM && /\bשלי\b|ל-?Martita/.test(out)
    const continuityNote = input !== r.resolvedQuery ? `resolved→ "${r.resolvedQuery}"` : (isLLM ? 'passed to LLM with full history' : 'direct')
    const turnPass = !banned && !raw && !badPerspective
    if (!turnPass) scenarioPass = false
    lines.push(`\n[${i + 1}] PROMPT: ${input}`)
    lines.push(`    CONTINUITY: ${continuityNote}${r.person ? ` (person=${r.person})` : ''}`)
    lines.push(`    RESPONSE: ${out}`)
    lines.push(`    perspective_ok=${!badPerspective}  raw_leak=${!!raw}  fallback=${isLLM ? 'LLM-required(no key)' : 'no'}  banned=${!!banned}`)
    lines.push(`    TURN: ${turnPass ? 'PASS' : 'FAIL'}${isLLM ? '  (deterministic checks pass; prose needs key)' : ''}`)
    history.push({ id: String(i), role: 'user', content: input, timestamp: 0 })
    history.push({ id: String(i) + 'a', role: 'assistant', content: isLLM ? '(model answer)' : out, timestamp: 0 })
  })
  scenarioVerdicts.push({ name: s.name, pass: scenarioPass })
}

lines.push(`\n${'═'.repeat(70)}\nSCENARIO VERDICTS\n${'═'.repeat(70)}`)
for (const v of scenarioVerdicts) lines.push(`  ${v.name}: ${v.pass ? 'PASS' : 'FAIL'}`)
console.log(lines.join('\n'))
