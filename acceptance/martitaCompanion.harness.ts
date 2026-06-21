/*
 * Martita Companion Acceptance Suite.
 *
 * Scores companion behaviour 0-3 against the REAL runtime engines (no LLM for
 * the deterministic checks). HARD FAILS: fake save, raw JSON/tool output,
 * banned register, wrong family relation, wrong calendar action, no memory
 * continuity. Scenarios whose quality depends on real-model PROSE (Hebrew/
 * Spanish naturalness, news, general knowledge, boredom/loneliness wording) are
 * emitted as BLOCKED_BY_KEYS — never scored green without the model.
 *
 * Run: npx tsx acceptance/martitaCompanion.harness.ts
 */
import { writeFileSync } from 'fs'
import { resolve as pathResolve } from 'path'

// localStorage shim so calendar grounding runs under node.
const g = globalThis as unknown as { localStorage?: Storage }
if (typeof g.localStorage === 'undefined') {
  const m = new Map<string, string>()
  g.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage
}

import { planCompanionTurn, deriveStateFromMessages } from '../src/screens/AbuAI/companionPlanner'
import { enforceCompanion, findBannedPhrase } from '../src/screens/AbuAI/companionComposer'
import { tryGroundedAnswer } from '../src/screens/AbuAI/service'
import { routePersonalQuery } from '../src/screens/AbuAI/router'
import { saveAppointments, loadAppointments, createAppointmentSafe } from '../src/screens/AbuCalendar/service'
import { resolveRelationalQuery } from '../src/screens/AbuAI/relationalResolver'

// seed tomorrow 16:00 for calendar reads
const now = new Date(); const tmr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
const tISO = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`
saveAppointments([{ id: 's1', title: 'רופא', date: tISO, time: '16:00', emoji: '🏥', color: '#C9A84C' }] as never)

const DIRECT_Q = /^מי |^מתי |^איפה |^כמה |^מה זה |^מה זאת |[?؟]$/
interface Msg { role: 'user' | 'assistant'; content: string }

/** Run one turn through the real deterministic pipeline → response + meta. */
function runTurn(msg: string, history: Msg[]): { response: string; source: string; route: string } {
  const plan = planCompanionTurn(msg, deriveStateFromMessages(history))
  let eff = msg
  if (plan.step4_continuity.continuesTopic && plan.step4_continuity.resolvedPerson && !plan.step3_familyEntity && !plan.suppressLookups && plan.step5_calendar === 'none' && !plan.step6_onlineNeeded) {
    eff = `ספרי לי על ${plan.step4_continuity.resolvedPerson}`
  }
  const skip = plan.suppressLookups && !DIRECT_Q.test(eff.trim())
  let grounded: string | null = null
  try { grounded = skip ? null : tryGroundedAnswer(eff) } catch { grounded = null }
  if (grounded !== null) {
    const r = routePersonalQuery(eff)
    return { response: enforceCompanion(grounded, plan), source: 'grounded', route: r.type }
  }
  // open-chat / emotional / online → LLM (not run here). Composer floor still applies.
  return { response: enforceCompanion('—', plan), source: 'llm(blocked)', route: `${plan.step7_frame}/${plan.step7_act}` }
}

interface Scenario { id: string; cat: string; turns: string[]; check: (resps: string[], meta: { source: string; route: string }[]) => { score: 0 | 1 | 2 | 3; reason: string }; needs?: 'llm' }
const RAW_JSON = /[{[]"?\w+"?\s*:/ // crude raw-tool/JSON detector

function noRaw(r: string): boolean { return findBannedPhrase(r) === null && !RAW_JSON.test(r) }

const SC: Scenario[] = [
  // ── Family identity (deterministic) ──
  { id: 'M-FAM-1', cat: 'family/identity', turns: ['מי זאת מור?'], check: (r) => {
    if (!noRaw(r[0]!)) return { score: 0, reason: 'raw/banned' }
    const ok = r[0]!.includes('מור') && r[0]!.includes('הבת') && !r[0]!.includes('אופיר, איילון')
    return { score: ok ? 3 : 1, reason: ok ? 'concise role answer' : 'not concise/role' }
  } },
  { id: 'M-FAM-2', cat: 'family/depth', turns: ['מי זאת מור?', 'ספרי לי על מור'], check: (r) => {
    if (!noRaw(r[1]!)) return { score: 0, reason: 'raw/banned' }
    const diff = r[1] !== r[0] && r[1]!.length > r[0]!.length
    return { score: diff ? 3 : 0, reason: diff ? 'rich differs from terse' : 'identical (RC4 fail)' }
  } },
  // ── Inferred relations (deterministic) ──
  { id: 'M-FAM-3', cat: 'family/inference', turns: ['מי סבתא רבתא של אנאבל?'], check: (r) => ({ score: r[0]!.includes('מרטיטה') && noRaw(r[0]!) ? 3 : 0, reason: r[0]!.includes('מרטיטה') ? 'great-grandmother inferred' : 'wrong relation (HARD)' }) },
  { id: 'M-FAM-4', cat: 'family/inference', turns: ['מי דוד של אופיר?'], check: (r) => ({ score: r[0]!.includes('לאו') && noRaw(r[0]!) ? 3 : 0, reason: r[0]!.includes('לאו') ? 'uncle inferred' : 'wrong relation (HARD)' }) },
  { id: 'M-FAM-5', cat: 'family/partner', turns: ['מי החברה של מור?'], check: (r) => ({ score: r[0]!.includes('יעל') && noRaw(r[0]!) ? 3 : 0, reason: r[0]!.includes('יעל') ? 'partner alias → Yael' : 'wrong (HARD)' }) },
  // ── Calendar read (deterministic) ──
  { id: 'M-CAL-1', cat: 'calendar/read-exact', turns: ['מה יש לי מחר בארבע?'], check: (r) => ({ score: r[0]!.includes('רופא') && !r[0]!.includes('אין כלום') && noRaw(r[0]!) ? 3 : 0, reason: r[0]!.includes('רופא') ? 'exact-time correct' : 'wrong calendar action (HARD)' }) },
  { id: 'M-CAL-2', cat: 'calendar/read-day', turns: ['מה יש לי מחר?'], check: (r) => ({ score: r[0]!.includes('רופא') && noRaw(r[0]!) ? 3 : 1, reason: r[0]!.includes('רופא') ? 'day read correct' : 'no event surfaced' }) },
  // ── Follow-up / memory continuity (deterministic) ──
  { id: 'M-MEM-1', cat: 'memory/continuity', turns: ['מי זאת יעל?', 'ספרי לי עליה'], check: (r) => ({ score: r[1]!.includes('יעל') && noRaw(r[1]!) ? 3 : 0, reason: r[1]!.includes('יעל') ? 'pronoun grounded to last person' : 'continuity lost (HARD)' }) },
  // ── Trust / fake-save prevention (deterministic, direct engine) ──
  { id: 'M-TRUST-1', cat: 'trust/no-fake-save', turns: ['__SAVE_VERIFY__'], check: () => {
    const res = createAppointmentSafe({ title: 'בדיקה', date: tISO, time: '11:00', notes: null, emoji: '🩺' } as never)
    const found = loadAppointments().some(a => a.title === 'בדיקה' && a.date === tISO && a.time === '11:00')
    const ok = (res as { ok?: boolean }).ok !== false && found
    return { score: ok ? 3 : 0, reason: ok ? 'save verified by readback' : 'fake-save risk (HARD)' }
  } },
  // ── Spanish / English relational (deterministic, L-2 closed) ──
  { id: 'M-ES-REL', cat: 'spanish/relational', turns: ['la mamá de Ofir'], check: () => {
    const a = resolveRelationalQuery('la mamá de Ofir', 'es') ?? ''
    const ok = a.includes('Mor') && !/[֐-׿]/.test(a) && noRaw(a)
    return { score: ok ? 3 : 0, reason: ok ? 'ES relation, Latin name, no dump' : 'wrong relation (HARD)' }
  } },
  { id: 'M-EN-REL', cat: 'english/relational', turns: ["who is Ofir's uncle"], check: () => {
    const a = resolveRelationalQuery("who is Ofir's uncle", 'en') ?? ''
    const ok = a.includes('Leo') && noRaw(a)
    return { score: ok ? 3 : 0, reason: ok ? 'EN uncle inferred' : 'wrong relation (HARD)' }
  } },
  { id: 'M-FAM-HONEST', cat: 'family/no-invention', turns: ['la hija de Mor'], check: () => {
    const a = resolveRelationalQuery('la hija de Mor', 'es') ?? ''
    const ok = /no tiene/.test(a) // Mor has only sons — must not invent a daughter
    return { score: ok ? 3 : 0, reason: ok ? 'honest: no invented relation' : 'invented relation (HARD)' }
  } },
  // ── LLM-dependent (BLOCKED_BY_KEYS) ──
  { id: 'M-CASUAL-1', cat: 'casual chat', turns: ['מה נשמע?'], needs: 'llm', check: () => ({ score: 0, reason: 'prose quality needs live model' }) },
  { id: 'M-LONELY-1', cat: 'boredom/loneliness', turns: ['קצת בודד לי היום'], needs: 'llm', check: () => ({ score: 0, reason: 'prose quality needs live model' }) },
  { id: 'M-PAPI-1', cat: 'emotional/papi', turns: ['אני מתגעגעת לפאפי'], needs: 'llm', check: () => ({ score: 0, reason: 'prose quality needs live model' }) },
  { id: 'M-NEWS-1', cat: 'online/current', turns: ['מה חדש בעולם?'], needs: 'llm', check: () => ({ score: 0, reason: 'live network needed' }) },
  { id: 'M-GK-1', cat: 'general knowledge', turns: ['ספרי לי על המהפכה הצרפתית'], needs: 'llm', check: () => ({ score: 0, reason: 'prose quality needs live model' }) },
  { id: 'M-ES-1', cat: 'spanish/rioplatense', turns: ['contame de Leo'], needs: 'llm', check: () => ({ score: 0, reason: 'ES prose quality needs live model' }) },
]

interface Row { id: string; cat: string; score: number | 'BLOCKED'; reason: string; hardFail: boolean; sample: string }
const rows: Row[] = []
for (const s of SC) {
  if (s.needs === 'llm') { rows.push({ id: s.id, cat: s.cat, score: 'BLOCKED', reason: s.reason, hardFail: false, sample: s.turns.join(' / ') }); continue }
  const history: Msg[] = []
  const resps: string[] = []; const meta: { source: string; route: string }[] = []
  for (const t of s.turns) {
    if (t === '__SAVE_VERIFY__') { resps.push(''); meta.push({ source: 'engine', route: 'calendar_create' }); continue }
    const out = runTurn(t, history); resps.push(out.response); meta.push({ source: out.source, route: out.route })
    history.push({ role: 'user', content: t }); history.push({ role: 'assistant', content: out.response })
  }
  const res = s.check(resps, meta)
  rows.push({ id: s.id, cat: s.cat, score: res.score, reason: res.reason, hardFail: res.score === 0 && /HARD/.test(res.reason), sample: resps.filter(Boolean).join(' | ').slice(0, 90) })
}

const scored = rows.filter(r => r.score !== 'BLOCKED') as (Row & { score: number })[]
const blocked = rows.filter(r => r.score === 'BLOCKED')
const hardFails = scored.filter(r => r.hardFail)
const avg = scored.length ? (scored.reduce((n, r) => n + (r.score as number), 0) / scored.length).toFixed(2) : '0'

const out: string[] = []
out.push('# MARTITA COMPANION ACCEPTANCE — results')
out.push('')
out.push('Scored 0-3 against the REAL deterministic engines. HARD FAIL on fake-save, raw/banned output, wrong relation, wrong calendar action, lost continuity. LLM-prose scenarios are BLOCKED_BY_KEYS (not scored green).')
out.push('')
out.push(`**Deterministic:** ${scored.length} scenarios · avg ${avg}/3 · hard-fails ${hardFails.length}`)
out.push(`**Blocked (need live model/network):** ${blocked.length}`)
out.push('')
out.push('| ID | Category | Score | Reason | Sample |')
out.push('|----|----------|-------|--------|--------|')
for (const r of rows) out.push(`| ${r.id} | ${r.cat} | ${r.score === 'BLOCKED' ? '🔴 BLOCKED' : r.score} | ${r.reason} | ${(r.sample || '').replace(/\|/g, '\\|')} |`)
writeFileSync(pathResolve(process.cwd(), 'docs/abuai/MARTITA_COMPANION_ACCEPTANCE.md'), out.join('\n'), 'utf-8')

console.log(`MARTITA COMPANION  deterministic:${scored.length} avg:${avg}/3 hardFails:${hardFails.length} blocked:${blocked.length}`)
for (const r of hardFails) console.log(`  HARD FAIL ${r.id} — ${r.reason}`)
process.exitCode = hardFails.length > 0 ? 1 : 0
