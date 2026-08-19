/*
 * Companion Brain Acceptance Harness — DETERMINISTIC planning layer.
 *
 * Runs multi-turn conversations through the real planner (companionPlanner) and
 * asserts the DECISIONS that separate a companion from a tool:
 *   - emotional suppression (no family/calendar lookup during grief/worry)
 *   - mood stickiness (an incidental factual turn does not reset grief)
 *   - companionship lead on boredom (not trivia)
 *   - continuity (pronoun/“ועוד?” resolves to the last person/topic)
 *   - correct frame/act for calendar, online, family-fact
 *
 * It validates STEP 1–7 (the plan). STEP 8 (wording in AbuAI's voice) and the
 * felt-warmth of the final text require the live LLM and are NOT scored here —
 * reported separately as NOT PROVEN.
 *
 * Run: npx tsx acceptance/companionBrain.harness.ts
 */
import { writeFileSync } from 'fs'
import { resolve as pathResolve } from 'path'
import {
  planCompanionTurn, advanceState, EMPTY_STATE,
  type ConversationState, type CompanionPlan,
} from '../src/screens/AbuAI/companionPlanner'

type Assert = Partial<Pick<CompanionPlan, 'step7_frame' | 'step7_act' | 'suppressLookups' | 'step5_calendar' | 'step6_onlineNeeded'>>
  & { resolvedPerson?: string | null }
interface Turn { input: string; expect: Assert; note: string }
interface Convo { id: string; title: string; turns: Turn[] }

const CONVOS: Convo[] = [
  {
    id: 'GRIEF', title: 'Grief — suppression + stickiness',
    turns: [
      { input: 'אני מתגעגעת לפאפי', note: 'grief → listen, suppress lookups (even though פאפי is an entity)',
        expect: { step7_frame: 'emotion', step7_act: 'listen', suppressLookups: true } },
      { input: 'הוא תמיד היה שר בבוקר', note: 'sharing a memory → still emotion, suppressed',
        expect: { step7_frame: 'emotion', suppressLookups: true } },
      { input: 'מה השעה?', note: 'incidental factual turn must NOT reset grief (stickiness)',
        expect: { step7_frame: 'emotion', suppressLookups: true } },
    ],
  },
  {
    id: 'WORRY', title: 'Worry about a child — family lookup suppressed',
    turns: [
      { input: 'אופיר לא התקשר ונעלב לי', note: 'worry → emotion, suppress family lookup on אופיר',
        expect: { step7_frame: 'emotion', step7_act: 'listen', suppressLookups: true } },
    ],
  },
  {
    id: 'BORED', title: 'Boredom — companionship lead',
    turns: [
      { input: 'משעמם לי', note: 'boredom → companionship, LEAD (not trivia), suppress data-dump',
        expect: { step7_frame: 'companionship', step7_act: 'lead', suppressLookups: true } },
    ],
  },
  {
    id: 'LONELY', title: 'Loneliness — presence',
    turns: [
      { input: 'קצת בודד לי היום', note: 'loneliness → emotion/presence, listen',
        expect: { step7_frame: 'emotion', step7_act: 'listen', suppressLookups: true } },
    ],
  },
  {
    id: 'FAMILY_CONT', title: 'Family identity → pronoun continuity',
    turns: [
      { input: 'מי זאת מור?', note: 'family fact → answer; sets last_person=Mor',
        expect: { step7_frame: 'fact', step7_act: 'answer', resolvedPerson: 'מור' } },
      { input: 'ספרי לי עליה', note: 'pronoun → continue about Mor',
        expect: { step7_act: 'continue', resolvedPerson: 'מור' } },
      { input: 'ועוד?', note: '“ועוד?” continues the topic',
        expect: { step7_act: 'continue', resolvedPerson: 'מור' } },
    ],
  },
  {
    id: 'CAL', title: 'Calendar — read vs create',
    turns: [
      { input: 'מה יש לי מחר?', note: 'calendar read → task/answer',
        expect: { step7_frame: 'task', step7_act: 'answer', step5_calendar: 'read' } },
      { input: 'תקבעי מחר בשלוש עם מוטי', note: 'calendar create → task/confirm',
        expect: { step7_frame: 'task', step7_act: 'confirm', step5_calendar: 'create' } },
      { input: 'תזכירי לי לקחת כדור בשמונה', note: 'reminder → task/confirm',
        expect: { step7_frame: 'task', step7_act: 'confirm', step5_calendar: 'remind' } },
    ],
  },
  {
    id: 'ONLINE', title: 'Online current info',
    turns: [
      { input: 'מה מזג האוויר מחר?', note: 'weather → online, answer',
        expect: { step7_frame: 'fact', step7_act: 'answer', step6_onlineNeeded: true } },
      { input: 'ומה חדש בעולם?', note: 'news → online, answer',
        expect: { step6_onlineNeeded: true } },
    ],
  },
  {
    id: 'PRIDE', title: 'Pride — reflect & share joy (may add warm detail)',
    turns: [
      { input: 'אני כל כך גאה, אופיר מתחתן!', note: 'pride → encourage; lookups NOT suppressed (can add a warm detail)',
        expect: { step7_frame: 'emotion', step7_act: 'encourage', suppressLookups: false } },
    ],
  },
  {
    id: 'MIXED', title: 'Mixed — grief then later a real task',
    turns: [
      { input: 'היה לי יום קשה, אני מתגעגעת לפאפי', note: 'grief → listen, suppress',
        expect: { step7_frame: 'emotion', suppressLookups: true } },
      { input: 'טוב. תקבעי לי רופא מחר בארבע', note: 'genuine task with energy shift → task/confirm',
        expect: { step7_frame: 'task', step5_calendar: 'create' } },
    ],
  },
]

interface Row { convo: string; turn: number; input: string; note: string; plan: string; pass: boolean; reason: string }
const rows: Row[] = []

for (const c of CONVOS) {
  let state: ConversationState = { ...EMPTY_STATE }
  c.turns.forEach((t, i) => {
    const plan = planCompanionTurn(t.input, state)
    const checks: string[] = []
    const e = t.expect
    if (e.step7_frame && plan.step7_frame !== e.step7_frame) checks.push(`frame ${plan.step7_frame}≠${e.step7_frame}`)
    if (e.step7_act && plan.step7_act !== e.step7_act) checks.push(`act ${plan.step7_act}≠${e.step7_act}`)
    if (e.suppressLookups !== undefined && plan.suppressLookups !== e.suppressLookups) checks.push(`suppress ${plan.suppressLookups}≠${e.suppressLookups}`)
    if (e.step5_calendar && plan.step5_calendar !== e.step5_calendar) checks.push(`cal ${plan.step5_calendar}≠${e.step5_calendar}`)
    if (e.step6_onlineNeeded !== undefined && plan.step6_onlineNeeded !== e.step6_onlineNeeded) checks.push(`online ${plan.step6_onlineNeeded}≠${e.step6_onlineNeeded}`)
    if (e.resolvedPerson !== undefined && plan.step4_continuity.resolvedPerson !== e.resolvedPerson) checks.push(`person ${plan.step4_continuity.resolvedPerson}≠${e.resolvedPerson}`)
    rows.push({
      convo: c.id, turn: i + 1, input: t.input, note: t.note,
      plan: `frame=${plan.step7_frame} act=${plan.step7_act} suppress=${plan.suppressLookups} cal=${plan.step5_calendar} online=${plan.step6_onlineNeeded} person=${plan.step4_continuity.resolvedPerson ?? '-'}`,
      pass: checks.length === 0, reason: checks.join('; '),
    })
    state = advanceState(state, plan)
  })
}

const pass = rows.filter(r => r.pass).length
const fail = rows.length - pass

const out: string[] = []
out.push('# COMPANION_BRAIN_RESULTS — Planning-layer acceptance (deterministic)')
out.push('')
out.push('> Generated by `acceptance/companionBrain.harness.ts`. Validates the COMPANION PLAN')
out.push('> (STEP 1–7: frame, act, suppression, continuity) across multi-turn conversations.')
out.push('> STEP 8 (wording in AbuAI\'s voice) and felt-warmth require the live LLM and are NOT scored here.')
out.push('')
out.push(`**Summary:** turns ${rows.length} · pass ${pass} · fail ${fail}`)
out.push('')
out.push('| Convo | Turn | Input | Plan (decision) | Pass | Fail reason | Companion behavior checked |')
out.push('|-------|------|-------|-----------------|------|-------------|----------------------------|')
for (const r of rows) {
  const cell = (s: string) => String(s).replace(/\|/g, '\\|')
  out.push(`| ${r.convo} | ${r.turn} | ${cell(r.input)} | ${cell(r.plan)} | ${r.pass ? '✅' : '❌'} | ${cell(r.reason)} | ${cell(r.note)} |`)
}
const outPath = pathResolve(process.cwd(), 'docs/abuai/COMPANION_BRAIN_RESULTS.md')
writeFileSync(outPath, out.join('\n'), 'utf-8')
console.log(`COMPANION BRAIN HARNESS  turns:${rows.length} pass:${pass} fail:${fail}`)
console.log(`results → ${outPath}`)
for (const r of rows.filter(x => !x.pass)) console.log(`  FAIL ${r.convo}#${r.turn} "${r.input}" — ${r.reason}`)
process.exitCode = fail > 0 ? 1 : 0
