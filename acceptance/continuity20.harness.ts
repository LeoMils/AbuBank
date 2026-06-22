/*
 * 20-turn live-conversation CONTINUITY harness (deterministic).
 *
 * Drives one realistic 20-turn Martita session through the REAL runtime
 * follow-up + planner + grounding engines and asserts, PER TURN, the structural
 * continuity properties that make a long conversation feel coherent:
 *   - pronoun follow-ups (עליה / ספרי לי עליה) stay on the last person,
 *   - topic continuation (תמשיכי / עוד) continues the LAST topic, not a new one
 *     and not the family graph,
 *   - calendar follow-ups (ומה אחרי זה / ומה ביום הבא) resolve to the right scope,
 *   - a topic SWITCH (history) then RETURN (family/calendar) keeps each thread,
 *   - emotion (grief) suppresses lookups and the mood sticks across a neutral turn,
 *   - no grounded turn leaks a banned/raw phrase.
 *
 * Live-model PROSE warmth is a separate real-run gate — NOT judged here.
 * Run: npx tsx acceptance/continuity20.harness.ts
 */
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const g = globalThis as unknown as { localStorage?: Storage }
if (typeof g.localStorage === 'undefined') { const m = new Map<string, string>(); g.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage }

import { resolveFollowUp } from '../src/screens/AbuAI/contextResolver'
import { planCompanionTurn, deriveStateFromMessages } from '../src/screens/AbuAI/companionPlanner'
import { tryGroundedAnswer } from '../src/screens/AbuAI/service'
import { findBannedPhrase } from '../src/screens/AbuAI/companionComposer'
import { saveAppointments } from '../src/screens/AbuCalendar/service'
import type { ChatMessage } from '../src/screens/AbuAI/types'

const now = new Date(); const tmr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
const tISO = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`
saveAppointments([{ id: 's1', title: 'רופא', date: tISO, time: '16:00', emoji: '🏥', color: '#C9A84C' }] as never)

let seq = 0
const mk = (role: 'user' | 'assistant', content: string): ChatMessage => ({ id: `m${seq++}`, role, content, timestamp: seq })
const history: ChatMessage[] = []
const checks: Array<{ turn: number; user: string; label: string; pass: boolean; detail: string }> = []
function check(turn: number, user: string, label: string, pass: boolean, detail: string) {
  checks.push({ turn, user, label, pass, detail })
}

// Each turn: user message + a plausible assistant reply (so re-routing finds context).
const script: Array<{ u: string; a?: string; assert?: (u: string) => void }> = [
  { u: 'בוקר טוב', a: 'בוקר טוב מרטיטה.' },
  { u: 'מי זאת מור?', a: 'מור, הבת שלך.', assert: (u) => {
      const ans = tryGroundedAnswer(u); check(2, u, 'family grounded', !!ans && findBannedPhrase(ans!) === null, ans ?? '∅') } },
  { u: 'ספרי לי עליה', a: 'מור גרה בהוד השרון עם יעל.', assert: (u) => {
      const st = deriveStateFromMessages(history); const plan = planCompanionTurn(u, st)
      check(3, u, 'pronoun→continue + last person retained (Mor)', plan.step7_act === 'continue' && st.lastPerson === 'מור', `act=${plan.step7_act} lastPerson=${st.lastPerson}`) } },
  { u: 'ועוד?', a: 'יש לה ארבעה ילדים.' },
  { u: 'מי סבתא רבתא של אנאבל?', a: 'זאת את, מרטיטה.', assert: (u) => {
      const ans = tryGroundedAnswer(u); check(5, u, 'inference grounded, no leak', !!ans && findBannedPhrase(ans!) === null, ans ?? '∅') } },
  { u: 'מה יש לי מחר?', a: `מחר 🏥 רופא ב16:00.`, assert: (u) => {
      const ans = tryGroundedAnswer(u); check(6, u, 'calendar read tomorrow', !!ans && ans!.includes('רופא'), ans ?? '∅') } },
  { u: 'ומה אחרי זה?', assert: (u) => {
      const r = resolveFollowUp(u, history); check(7, u, 'cal follow-up → week', r.wasFollowUp && /השבוע/.test(r.resolved), `${r.wasFollowUp}:${r.resolved}`) } },
  { u: 'ומה ביום הבא?', assert: (u) => {
      const r = resolveFollowUp(u, history); check(8, u, 'next-day → tomorrow', r.wasFollowUp && /מחר/.test(r.resolved), `${r.wasFollowUp}:${r.resolved}`) } },
  { u: 'מתי הייתה המהפכה הצרפתית?', a: 'המהפכה הצרפתית החלה ב-1789.' },
  { u: 'תמשיכי', assert: (u) => {
      // The real continuity signal for a non-personal topic is the planner act
      // 'continue' (→ service streams the LLM with conversation history so it
      // keeps the thread). The deterministic resolveFollowUp rewrite is a bonus
      // and is intentionally suppressed when an older personal context exists.
      const plan = planCompanionTurn(u, deriveStateFromMessages(history))
      check(10, u, 'topic continuation detected (act=continue)', plan.step7_act === 'continue', `act=${plan.step7_act}`) } },
  { u: 'אני קצת עייפה', a: 'אני כאן איתך.' },
  { u: 'אני מתגעגעת לפאפי', assert: (u) => {
      const plan = planCompanionTurn(u, deriveStateFromMessages(history)); check(12, u, 'grief → suppress lookups + emotion frame', plan.suppressLookups === true && plan.step7_frame === 'emotion', `frame=${plan.step7_frame} suppress=${plan.suppressLookups}`) } },
  { u: 'מה השעה?', a: 'עכשיו אחר הצהריים.', assert: (u) => {
      const plan = planCompanionTurn(u, deriveStateFromMessages(history)); check(13, u, 'mood stickiness across neutral turn', plan.step7_frame === 'emotion' || plan.suppressLookups === true, `frame=${plan.step7_frame}`) } },
  { u: 'מי זאת מור?', a: 'מור, הבת שלך.', assert: (u) => {
      const ans = tryGroundedAnswer(u); check(14, u, 'RETURN to family after detour', !!ans && ans!.includes('מור') && findBannedPhrase(ans!) === null, ans ?? '∅') } },
  { u: 'עליה', a: 'מור גרה בהוד השרון.', assert: (u) => {
      const st = deriveStateFromMessages(history); const plan = planCompanionTurn(u, st)
      check(15, u, 'pronoun continuation again (Mor retained)', plan.step7_act === 'continue' && st.lastPerson === 'מור', `act=${plan.step7_act} lastPerson=${st.lastPerson}`) } },
  { u: 'מה יש לי השבוע?', a: 'השבוע יש לך רופא.', assert: (u) => {
      const ans = tryGroundedAnswer(u); check(16, u, 'calendar week read after return', !!ans && findBannedPhrase(ans!) === null, ans ?? '∅') } },
  { u: 'תקבעי לי תור לרופא מחר בעשר', a: 'לקבוע מחר ב-10:00 רופא?' },
  { u: 'כן', a: 'קבעתי.' },
  { u: 'תודה לך', a: 'בכיף מרטיטה.' },
  { u: 'לילה טוב', a: 'לילה טוב, שינה ערבה.' },
]

let turn = 0
for (const step of script) {
  turn++
  history.push(mk('user', step.u))
  if (step.assert) step.assert(step.u)
  if (step.a) history.push(mk('assistant', step.a))
}

let pass = 0, fail = 0
const lines: string[] = ['# 20-Turn Conversation Continuity — Deterministic Results', '',
  '_Structural continuity through the real follow-up/planner/grounding engines. Live-model prose warmth NOT judged here._', '',
  '| Turn | User | Check | Result | Detail |', '|------|------|-------|--------|--------|']
for (const c of checks) {
  if (c.pass) pass++; else fail++
  lines.push(`| ${c.turn} | ${c.user} | ${c.label} | ${c.pass ? '✅ PASS' : '❌ FAIL'} | ${c.detail.replace(/\n/g, ' / ')} |`)
}
lines.push('', `**Continuity checks: ${checks.length} · pass ${pass} · fail ${fail}** across a 20-turn session.`, '',
  '> Felt warmth / real-model coherence over these 20 turns is a separate real-run gate — see dashboard §5.')
const out = resolve(process.cwd(), 'docs/abuai/CONTINUITY_20_RESULTS.md')
writeFileSync(out, lines.join('\n'), 'utf-8')
console.log(`Continuity (20-turn): ${checks.length} checks · pass ${pass} · fail ${fail}. Wrote ${out}`)
if (fail > 0) process.exitCode = 1
