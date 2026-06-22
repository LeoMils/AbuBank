/*
 * Hebrew natural-conversation acceptance harness (DETERMINISTIC).
 *
 * Runs 32 real Hebrew turns through the actual runtime engines (resolveFollowUp →
 * planCompanionTurn → tryGroundedAnswer / proactive seed → enforceCompanion) and
 * scores the response Martita would see on: not-robotic, not-patronizing,
 * not-third-person, no-menu, no-raw-output, Hebrew, correct perspective ("שלך"
 * not "שלי"). General-knowledge/history prose is the LLM's job; for those turns
 * the deterministic FLOOR is scored instead: routed non_personal (no fabricated
 * family/calendar) + sane plan. Real-model prose FEEL is the only Martita sliver.
 *
 * Run: npx tsx acceptance/hebrewConversation.harness.ts
 */
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const g = globalThis as unknown as { localStorage?: Storage }
if (typeof g.localStorage === 'undefined') { const m = new Map<string, string>(); g.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage }

import { planCompanionTurn, deriveStateFromMessages } from '../src/screens/AbuAI/companionPlanner'
import { enforceCompanion } from '../src/screens/AbuAI/companionComposer'
import { tryGroundedAnswer } from '../src/screens/AbuAI/service'
import { resolveFollowUp } from '../src/screens/AbuAI/contextResolver'
import { routePersonalQuery } from '../src/screens/AbuAI/router'
import { getProactiveSeed } from '../src/screens/AbuAI/proactive'
import { saveAppointments } from '../src/screens/AbuCalendar/service'
import type { ChatMessage } from '../src/screens/AbuAI/types'
import { scoreResponse, renderReport, type HarnessReport } from './lib/score'

const now = new Date(); const tmr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
const tISO = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`
saveAppointments([{ id: 's1', title: 'רופא', date: tISO, time: '16:00', emoji: '🏥', color: '#C9A84C' }] as never)

let seq = 0
const mk = (role: 'user' | 'assistant', content: string): ChatMessage => ({ id: `m${seq++}`, role, content, timestamp: seq })
const history: ChatMessage[] = []

type Cat = 'family' | 'calendar' | 'loneliness' | 'boredom' | 'grief' | 'correction' | 'followup' | 'history' | 'greeting'

/** Compute the deterministic response Martita would see + its category. */
function respond(userRaw: string): { kind: 'grounded' | 'emotional' | 'general'; text: string; route: string } {
  const state = deriveStateFromMessages(history)
  const plan = planCompanionTurn(userRaw, state)
  const resolved = resolveFollowUp(userRaw, history).resolved
  const route = routePersonalQuery(resolved).type
  // Mirror handleSend ordering: emotion suppresses lookups → companion seed first;
  // otherwise GROUNDED (family/calendar) before the proactive seed (step 14 < 16).
  const isDirectQ = /^(מי|מה|איפה|מתי|כמה)\b/i.test(userRaw.trim()) || /[?؟]/.test(userRaw)
  if (plan.suppressLookups && !isDirectQ) {
    const seed = getProactiveSeed(userRaw, {})
    return { kind: 'emotional', text: enforceCompanion(seed?.text ?? '', plan), route }
  }
  const grounded = tryGroundedAnswer(resolved)
  if (grounded) return { kind: 'grounded', text: enforceCompanion(grounded, plan), route }
  const seed = getProactiveSeed(userRaw, {})
  if (seed) return { kind: 'emotional', text: enforceCompanion(seed.text, plan), route }
  return { kind: 'general', text: '', route } // LLM territory — floor scored on routing
}

const SCRIPT: Array<{ u: string; cat: Cat; a?: string }> = [
  { u: 'בוקר טוב', cat: 'greeting', a: 'בוקר טוב מרטיטה.' },
  { u: 'מי זאת מור?', cat: 'family', a: 'מור, הבת שלך.' },
  { u: 'ספרי לי עליה', cat: 'followup', a: 'מור גרה בהוד השרון עם יעל.' },
  { u: 'ועוד?', cat: 'followup', a: 'יש לה ארבעה ילדים.' },
  { u: 'מי הילדים של מור?', cat: 'family', a: 'אופיר, איילון, עילי ואדר.' },
  { u: 'מי סבתא רבתא של אנאבל?', cat: 'family', a: 'זאת את.' },
  { u: 'מי דוד של אופיר?', cat: 'family', a: 'לאו.' },
  { u: 'מתי יום הזיכרון של פפי?', cat: 'family', a: '1 בינואר.' },
  { u: 'מה יש לי מחר?', cat: 'calendar', a: 'מחר יש לך רופא ב-16:00.' },
  { u: 'ומה אחרי זה?', cat: 'followup', a: 'השבוע יש לך רופא.' },
  { u: 'ומה ביום הבא?', cat: 'followup', a: 'מחר יש לך רופא.' },
  { u: 'מה יש לי מחר אחרי ארבע?', cat: 'calendar', a: 'מחר אין כלום אחרי ארבע.' },
  { u: 'מה יש לי מחר לפני ארבע?', cat: 'calendar', a: 'מחר יש לך רופא.' },
  { u: 'משעמם לי', cat: 'boredom', a: 'בא לך שנדבר?' },
  { u: 'לא יודעת', cat: 'boredom', a: 'אני כאן.' },
  { u: 'קצת בודד לי היום', cat: 'loneliness', a: 'אני איתך.' },
  { u: 'תשארי איתי', cat: 'loneliness', a: 'אני פה.' },
  { u: 'אני מתגעגעת לפאפי', cat: 'grief', a: 'אני יודעת, מרטיטה.' },
  { u: 'הוא תמיד שר בבוקר', cat: 'grief', a: 'כן.' },
  { u: 'מה השעה?', cat: 'grief', a: 'אחר הצהריים.' },
  { u: 'ספרי לי על המהפכה הצרפתית', cat: 'history', a: 'המהפכה הצרפתית החלה ב-1789.' },
  { u: 'כן, תמשיכי', cat: 'followup', a: 'אחריה הגיעה הרפובליקה.' },
  { u: 'ומה קרה אחר כך?', cat: 'history', a: 'נפוליאון עלה לשלטון.' },
  { u: 'מי החברה של מור?', cat: 'family', a: 'יעל.' },
  { u: 'מי זאת מור?', cat: 'family', a: 'מור, הבת שלך.' },
  { u: 'לא לזה התכוונתי', cat: 'correction', a: 'אז למה התכוונת?' },
  { u: 'תחזרי למור', cat: 'correction', a: 'מור, הבת שלך.' },
  { u: 'עזבי', cat: 'correction', a: 'בסדר, עזבנו.' },
  { u: 'מי סבתא רבתא של ארי?', cat: 'family', a: 'זאת את.' },
  { u: 'איפה גרה מור?', cat: 'family', a: 'בהוד השרון.' },
  { u: 'מה יש לי השבוע?', cat: 'calendar', a: 'השבוע יש לך רופא.' },
  { u: 'תודה לך', cat: 'greeting', a: 'בכיף מרטיטה.' },
]

const report: HarnessReport = { title: 'Hebrew Natural-Conversation — Deterministic Results', rows: [] }
let i = 0
for (const step of SCRIPT) {
  i++
  history.push(mk('user', step.u))
  const r = respond(step.u)
  let pass: boolean, fails: string[], got: string
  if (r.kind === 'general') {
    // History/general-knowledge prose is the LLM's; deterministic FLOOR = clean routing.
    const floorOk = r.route === 'non_personal'
    pass = floorOk; fails = floorOk ? [] : ['leaked_personal_route']
    got = `(LLM prose — floor: route=${r.route})`
  } else {
    const perspectiveSensitive = step.cat === 'family' || step.cat === 'calendar' || step.cat === 'followup'
    const sc = scoreResponse(r.text, { lang: 'he', perspectiveSensitive })
    pass = sc.pass; fails = sc.fails; got = r.text || '(empty)'
  }
  report.rows.push({ id: `HE-${i}`, cat: `${step.cat}/${r.kind}`, user: step.u, got, pass, fails })
  if (step.a) history.push(mk('assistant', step.a))
}

const { md, pass, fail } = renderReport(report)
const out = resolve(process.cwd(), 'docs/abuai/HEBREW_CONVERSATION_RESULTS.md')
writeFileSync(out, md, 'utf-8')
console.log(`Hebrew conversation: ${report.rows.length} turns · pass ${pass} · fail ${fail}. Wrote ${out}`)
if (fail > 0) { for (const row of report.rows.filter(r => !r.pass)) console.log(`  FAIL ${row.id} [${row.cat}] "${row.user}" → "${row.got}" :: ${row.fails.join(', ')}`); process.exitCode = 1 }
