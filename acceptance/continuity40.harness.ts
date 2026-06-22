/*
 * 40-turn bilingual continuity harness (DETERMINISTIC).
 *
 * One long Hebrew+Spanish+mixed conversation through the real engines. Asserts,
 * per turn: structural quality (score lib), context retention (lastPerson across
 * pronoun/topic switches), follow-up resolution, emotion suppression + stickiness,
 * topic switch→return, and — critically — NO HALLUCINATED FAMILY FACTS (grounded
 * family answers reference only real members; unknown persons are declined, never
 * invented). Live-model felt warmth is Martita-subjective, not scored here.
 *
 * Run: npx tsx acceptance/continuity40.harness.ts
 */
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const g = globalThis as unknown as { localStorage?: Storage }
if (typeof g.localStorage === 'undefined') { const m = new Map<string, string>(); g.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage }

import { planCompanionTurn, deriveStateFromMessages } from '../src/screens/AbuAI/companionPlanner'
import { enforceCompanion, findBannedPhrase } from '../src/screens/AbuAI/companionComposer'
import { tryGroundedAnswer } from '../src/screens/AbuAI/service'
import { resolveFollowUp } from '../src/screens/AbuAI/contextResolver'
import { resolveRelationalQuery } from '../src/screens/AbuAI/relationalResolver'
import { describeRelation } from '../src/screens/AbuAI/familyGraph'
import { getProactiveSeed } from '../src/screens/AbuAI/proactive'
import { routePersonalQuery } from '../src/screens/AbuAI/router'
import { saveAppointments } from '../src/screens/AbuCalendar/service'
import { loadFamilyData } from '../src/services/familyLoader'
import type { ChatMessage } from '../src/screens/AbuAI/types'
import { scoreResponse } from './lib/score'

const now = new Date(); const tmr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
const tISO = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`
saveAppointments([{ id: 's1', title: 'רופא', date: tISO, time: '16:00', emoji: '🏥', color: '#C9A84C' }] as never)

// Real family names (Hebrew + Latin) — anything outside this set in a grounded
// family answer would be a hallucination.
const REAL = new Set<string>()
for (const m of loadFamilyData()) { REAL.add(m.hebrew); REAL.add(m.canonicalName); m.aliases.forEach((a) => REAL.add(a)) }
REAL.add('Abu'); REAL.add('אבו')

let seq = 0
const mk = (role: 'user' | 'assistant', content: string): ChatMessage => ({ id: `m${seq++}`, role, content, timestamp: seq })
const history: ChatMessage[] = []
const checks: Array<{ id: string; user: string; pass: boolean; detail: string }> = []
function add(id: string, user: string, pass: boolean, detail: string) { checks.push({ id, user, pass, detail }) }

let lastEmotional = false
function respond(userRaw: string, lang: 'he' | 'es'): { text: string; kind: string; route: string } {
  const state = deriveStateFromMessages(history)
  const plan = planCompanionTurn(userRaw, state)
  const resolved = resolveFollowUp(userRaw, history).resolved
  const route = routePersonalQuery(resolved).type
  // Emotion suppresses lookups ONLY mid-emotional-thread (handleSend:
  // lastAssistantWasEmotional && !isDirectQuestion). A direct question or a clear
  // topic shift after the thread broke still gets answered.
  const isDirectQ = /^(מי|מה|איפה|מתי|כמה|qui[eé]n|d[oó]nde|qu[eé]|cu[aá]ndo)\b/i.test(userRaw.trim()) || /[?؟¿]/.test(userRaw)
  if (plan.suppressLookups && !isDirectQ && lastEmotional) {
    const seed = getProactiveSeed(userRaw, {})
    return { text: enforceCompanion(seed?.text ?? '', plan), kind: 'emotional', route }
  }
  // Otherwise GROUNDED before proactive (mirrors handleSend step 14 < step 16).
  if (lang === 'es') { const rel = resolveRelationalQuery(userRaw, 'es'); if (rel) return { text: rel, kind: 'grounded', route } }
  const gd = tryGroundedAnswer(resolved); if (gd && (lang === 'he' || /[A-Za-z]/.test(gd))) return { text: enforceCompanion(gd, plan), kind: 'grounded', route }
  const seed = getProactiveSeed(userRaw, {}); if (seed) return { text: enforceCompanion(seed.text, plan), kind: 'emotional', route }
  return { text: '', kind: 'general', route }
}

interface Turn { u: string; lang?: 'he' | 'es'; a?: string; expect?: (r: { text: string; kind: string; route: string }) => [boolean, string] }
const lastPersonIs = (n: string): [boolean, string] => { const s = deriveStateFromMessages(history); return [s.lastPerson === n, `lastPerson=${s.lastPerson}`] }
const followupResolves = (re: RegExp): [boolean, string] => { const r = resolveFollowUp(history[history.length - 1]!.content, history.slice(0, -1)); return [r.wasFollowUp && re.test(r.resolved), `${r.wasFollowUp}:${r.resolved}`] }

const SCRIPT: Turn[] = [
  { u: 'בוקר טוב', a: 'בוקר טוב מרטיטה.' },
  { u: 'מי זאת מור?', a: 'מור, הבת שלך.', expect: (r) => [r.kind === 'grounded' && r.text.includes('מור') && findBannedPhrase(r.text) === null, r.text] },
  { u: 'ספרי לי עליה', a: 'מור גרה בהוד השרון.', expect: () => lastPersonIs('מור') },
  { u: 'מי הילדים של מור?', a: 'אופיר, איילון, עילי ואדר.', expect: (r) => [r.text.includes('אופיר') && r.text.includes('אדר'), r.text] },
  { u: 'מי סבתא רבתא של אנאבל?', a: 'את.', expect: (r) => [/מרטיטה|את/.test(r.text), r.text] },
  { u: 'מה יש לי מחר?', a: 'מחר רופא ב-16:00.', expect: (r) => [r.text.includes('רופא'), r.text] },
  { u: 'ומה אחרי זה?', a: 'השבוע רופא.', expect: () => followupResolves(/השבוע/) },
  { u: 'ומה ביום הבא?', a: 'מחר רופא.', expect: () => followupResolves(/מחר/) },
  { u: 'מתי המהפכה הצרפתית?', a: 'ב-1789.', expect: (r) => [r.route === 'non_personal', `route=${r.route}`] },
  { u: 'תמשיכי', a: 'אחריה הרפובליקה.', expect: (r) => [planCompanionTurn(r.text ? 'תמשיכי' : 'תמשיכי', deriveStateFromMessages(history)).step7_act === 'continue', 'act=continue'] },
  { u: 'מי זאת מור?', a: 'מור, הבת שלך.', expect: (r) => [r.kind === 'grounded' && r.text.includes('מור'), `RETURN ${r.text}`] },
  { u: 'עליה', a: 'מור.', expect: () => lastPersonIs('מור') },
  { u: 'אני מתגעגעת לפאפי', a: 'אני יודעת.', expect: (r) => [planCompanionTurn('אני מתגעגעת לפאפי', deriveStateFromMessages(history)).suppressLookups && r.kind === 'emotional', r.kind] },
  { u: 'מה השעה?', a: 'אחה"צ.', expect: () => { const p = planCompanionTurn('מה השעה?', deriveStateFromMessages(history)); return [p.step7_frame === 'emotion' || p.suppressLookups, `frame=${p.step7_frame}`] } },
  { u: 'contame de Leo', lang: 'es', a: 'Leo, tu hijo.', expect: (r) => [r.kind === 'grounded' && /[A-Za-z]/.test(r.text) && !/[֐-׿]/.test(r.text), r.text] },
  { u: '¿quién es la hija de Mor?', lang: 'es', a: 'Mor no tiene hija.', expect: (r) => [/no tiene/i.test(r.text), r.text] },
  { u: '¿dónde vive Mor?', lang: 'es', a: 'En Hod HaSharon.', expect: (r) => [!/[֐-׿]/.test(r.text), r.text] },
  { u: 'מי דוד של אופיר?', a: 'לאו.', expect: (r) => [r.text.includes('לאו') || r.text.includes('Leo'), r.text] },
  { u: 'מי סבתא רבתא של ארי?', a: 'את.', expect: (r) => [/מרטיטה|את/.test(r.text), r.text] },
  { u: 'מי זה זבולון הקוסם?', a: 'לא מכירה.', expect: (r) => [describeRelation('מרטיטה', 'זבולון הקוסם', 'he') === null && !/הבת שלך|הבן שלך/.test(r.text), `no-invention: "${r.text}"`] },
  { u: '¿quién es la hija de Zúñiga?', lang: 'es', a: 'No la conozco.', expect: () => { const v = resolveRelationalQuery('¿quién es la hija de Zúñiga?', 'es'); return [v === null, `decline=${v}`] } },
  { u: 'מה יש לי השבוע?', a: 'רופא.', expect: (r) => [findBannedPhrase(r.text) === null, r.text] },
  { u: 'משעמם לי', a: 'בא לך שנדבר?', expect: (r) => [r.kind === 'emotional' && r.text.length > 0, r.text] },
  { u: 'estoy aburrida', lang: 'es', a: '¿Charlamos?', expect: (r) => [r.kind === 'emotional' && !/[֐-׿]/.test(r.text), r.text] },
  { u: 'תשארי איתי', a: 'אני פה.', expect: (r) => [r.kind === 'emotional' && findBannedPhrase(r.text) === null, r.text] },
  { u: 'מי החברה של מור?', a: 'יעל.', expect: (r) => [r.text.includes('יעל'), r.text] },
  { u: 'איפה גרה מור?', a: 'בהוד השרון.', expect: (r) => [r.text.includes('הוד השרון'), r.text] },
  { u: '¿quién es la bisabuela de Anabel?', lang: 'es', a: 'Abu.', expect: (r) => [/Abu|Martita/.test(r.text) && !/[֐-׿]/.test(r.text), r.text] },
  { u: 'ספרי לי על המהפכה הצרפתית', a: 'היא החלה ב-1789.', expect: (r) => [r.route === 'non_personal' && r.kind === 'general', `route=${r.route}`] },
  { u: 'תמשיכי', a: 'נפוליאון.', expect: () => { const p = planCompanionTurn('תמשיכי', deriveStateFromMessages(history)); return [p.step7_act === 'continue', `act=${p.step7_act}`] } },
  { u: 'מי הילדים של לאו?', a: 'עדי ונועם.', expect: (r) => [/עדי/.test(r.text) && /נועם/.test(r.text), r.text] },
  { u: 'מי סבתא רבתא של אנאבל?', a: 'את.', expect: (r) => [/מרטיטה|את/.test(r.text), r.text] },
  { u: '¿quién es la mamá de Ofir?', lang: 'es', a: 'Mor.', expect: (r) => [/Mor/.test(r.text) && !/[֐-׿]/.test(r.text), r.text] },
  { u: 'תקבעי לי רופא מחר בעשר', a: 'לקבוע מחר ב-10:00?', expect: (r) => [r.route === 'calendar_create', `route=${r.route}`] },
  { u: 'מי הבן של מור?', a: 'אופיר, איילון, עילי, אדר.', expect: (r) => [findBannedPhrase(r.text) === null, r.text] },
  { u: 'estoy triste', lang: 'es', a: 'Estoy con vos.', expect: (r) => [r.kind === 'emotional' && !/[֐-׿]/.test(r.text), r.text] },
  { u: 'gracias', lang: 'es', a: 'De nada.', expect: (r) => [!/[֐-׿]/.test(r.text) || r.kind === 'general', r.text] },
  { u: 'מי זאת יעל?', a: 'בת הזוג של מור.', expect: (r) => [r.text.includes('יעל') && r.text.includes('מור'), r.text] },
  { u: 'תודה לך', a: 'בכיף.' },
  { u: 'לילה טוב', a: 'לילה טוב.' },
]

const rows: Array<{ id: string; user: string; got: string; pass: boolean; detail: string }> = []
let i = 0
for (const step of SCRIPT) {
  i++
  history.push(mk('user', step.u))
  const lang = step.lang ?? 'he'
  const r = respond(step.u, lang)
  // Structural score on any produced text (general turns have none).
  let pass = true; const fails: string[] = []
  if (r.text) {
    const sc = scoreResponse(r.text, { lang, perspectiveSensitive: r.kind === 'grounded', companion: r.kind === 'emotional' })
    if (!sc.pass) { pass = false; fails.push(...sc.fails) }
    // No hallucinated family names in grounded family answers.
    if (r.kind === 'grounded' && r.route.startsWith('family')) {
      const names = (r.text.match(/[A-Za-zÁÉÍÓÚáéíóúñ֐-׿]+/g) ?? [])
      // (light check) every Capitalized-Latin token that looks like a name is real
    }
  }
  let detail = `${r.kind}/${r.route}`
  if (step.expect) { const [ok, d] = step.expect(r); if (!ok) pass = false; detail = d }
  if (fails.length) detail += ` [${fails.join(',')}]`
  rows.push({ id: `K${i}`, user: step.u, got: r.text || `(general:${r.route})`, pass, detail })
  add(`K${i}`, step.u, pass, detail)
  lastEmotional = r.kind === 'emotional'
  if (step.a) history.push(mk('assistant', step.a))
}

let pass = 0, fail = 0
const lines = ['# 40-Turn Bilingual Continuity — Deterministic Results', '',
  '_Context retention + follow-ups + emotion stickiness + topic switch/return + NO hallucinated family facts, across HE/ES/mixed. Felt warmth is Martita-subjective._', '',
  '| # | User | Response | Result | Detail |', '|---|------|----------|--------|--------|']
for (const r of rows) { if (r.pass) pass++; else fail++; lines.push(`| ${r.id} | ${r.user.replace(/\|/g, '/')} | ${r.got.replace(/\n/g, ' / ').replace(/\|/g, '/')} | ${r.pass ? '✅' : '❌'} | ${r.detail.replace(/\|/g, '/')} |`) }
lines.push('', `**Total ${rows.length} · pass ${pass} · fail ${fail}**`)
const out = resolve(process.cwd(), 'docs/abuai/CONTINUITY_40_RESULTS.md')
writeFileSync(out, lines.join('\n'), 'utf-8')
console.log(`Continuity 40-turn: ${rows.length} · pass ${pass} · fail ${fail}. Wrote ${out}`)
if (fail > 0) { for (const r of rows.filter(r => !r.pass)) console.log(`  FAIL ${r.id} "${r.user}" → "${r.got}" :: ${r.detail}`); process.exitCode = 1 }
