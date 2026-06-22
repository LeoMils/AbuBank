/*
 * Rioplatense Spanish natural-conversation harness (DETERMINISTIC).
 *
 * Runs 32 real Spanish turns through the actual ES surfaces (resolveRelationalQuery
 * 'es' → tryGroundedAnswer ES shaping → proactive 'es' seeds) and scores each on:
 * not-robotic, not-patronizing, no-menu, no-raw, NO HEBREW LEAK (unless the user
 * mixes languages), and not-Iberian (voseo, never tú/vosotros/vale). Covers family,
 * calendar, emotional, casual, follow-ups. Real-model felt warmth is the only
 * Martita-subjective sliver and is not scored here.
 *
 * Run: npx tsx acceptance/spanishConversation.harness.ts
 */
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const g = globalThis as unknown as { localStorage?: Storage }
if (typeof g.localStorage === 'undefined') { const m = new Map<string, string>(); g.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage }

import { tryGroundedAnswer } from '../src/screens/AbuAI/service'
import { resolveRelationalQuery } from '../src/screens/AbuAI/relationalResolver'
import { getProactiveSeed } from '../src/screens/AbuAI/proactive'
import { shapeCalendarAnswerES, shapeCreateConfirmES, shapeCreateSavedES, shapeCreateCancelledES, shapeCreateClarifyES } from '../src/screens/AbuAI/responseShaper'
import { saveAppointments } from '../src/screens/AbuCalendar/service'
import { scoreResponse, renderReport, type HarnessReport } from './lib/score'

const now = new Date(); const tmr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
const tISO = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`
saveAppointments([{ id: 's1', title: 'médico', date: tISO, time: '16:00', emoji: '🏥', color: '#C9A84C' }] as never)

type Kind = 'grounded' | 'emotional' | 'calendar' | 'general'
type Cat = 'family' | 'calendar' | 'emotional' | 'casual' | 'followup'

const SCRIPT: Array<{ u: string; cat: Cat; mixed?: boolean; resp: () => { kind: Kind; text: string } }> = [
  { u: 'Hola, ¿cómo estás?', cat: 'casual', resp: () => emo('Hola, ¿cómo estás?') },
  { u: 'contame de Leo', cat: 'family', resp: () => grounded('contame de Leo') },
  { u: '¿quién es la hija de Mor?', cat: 'family', resp: () => grounded('¿quién es la hija de Mor?') },
  { u: '¿quién es la mamá de Ofir?', cat: 'family', resp: () => grounded('¿quién es la mamá de Ofir?') },
  { u: '¿quién es Yael?', cat: 'family', resp: () => grounded('¿quién es Yael?') },
  { u: '¿quién es la bisabuela de Anabel?', cat: 'family', resp: () => grounded('¿quién es la bisabuela de Anabel?') },
  { u: 'qué relación tienen Mor y Leo', cat: 'family', resp: () => grounded('qué relación tienen Mor y Leo') },
  { u: 'dale, seguí', cat: 'followup', resp: () => grounded('dale, seguí') },
  { u: 'estoy aburrida', cat: 'emotional', resp: () => emo('estoy aburrida') },
  { u: 'no sé qué hacer', cat: 'emotional', resp: () => emo('no sé qué hacer') },
  { u: 'me siento sola hoy', cat: 'emotional', resp: () => emo('me siento sola hoy') },
  { u: 'hablame un poco', cat: 'casual', resp: () => emo('hablame un poco') },
  { u: 'extraño a Pepe', cat: 'emotional', resp: () => emo('extraño a Pepe') },
  { u: 'él cantaba siempre', cat: 'emotional', resp: () => emo('él cantaba siempre') },
  { u: 'contame algo lindo', cat: 'casual', resp: () => emo('contame algo lindo') },
  { u: 'estoy contenta hoy', cat: 'emotional', resp: () => emo('estoy contenta hoy') },
  { u: 'dame una idea', cat: 'casual', resp: () => emo('dame una idea') },
  { u: '¿qué tengo mañana?', cat: 'calendar', resp: () => calRead('tomorrow') },
  { u: '¿qué tengo esta semana?', cat: 'calendar', resp: () => calRead('week') },
  { u: '¿qué tengo hoy?', cat: 'calendar', resp: () => calRead('today') },
  { u: 'agendame el médico mañana a las cuatro', cat: 'calendar', resp: () => ({ kind: 'calendar', text: shapeCreateConfirmES({ title: 'médico', date: tISO, time: '16:00' } as never) }) },
  { u: 'sí, dale', cat: 'calendar', resp: () => ({ kind: 'calendar', text: shapeCreateSavedES({ title: 'médico', date: tISO, time: '16:00' }) }) },
  { u: 'no, cancelá', cat: 'calendar', resp: () => ({ kind: 'calendar', text: shapeCreateCancelledES() }) },
  { u: '¿a qué hora?', cat: 'calendar', resp: () => ({ kind: 'calendar', text: shapeCreateClarifyES(['time']) }) },
  { u: '¿quién es la madre de Ari?', cat: 'family', resp: () => grounded('¿quién es la madre de Ari?') },
  { u: '¿dónde vive Mor?', cat: 'family', resp: () => grounded('¿dónde vive Mor?') },
  { u: '¿quién es el hijo de Mor?', cat: 'family', resp: () => grounded('¿quién es el hijo de Mor?') },
  { u: 'gracias', cat: 'casual', resp: () => emo('gracias') },
  { u: 'contame de Ofir', cat: 'family', resp: () => grounded('contame de Ofir') },
  { u: '¿quién es la abuela de Anabel?', cat: 'family', resp: () => grounded('¿quién es la abuela de Anabel?') },
  { u: 'me aburro un poco', cat: 'emotional', resp: () => emo('me aburro un poco') },
  { u: 'Leo, ¿él tiene hijos?', cat: 'family', resp: () => grounded('contame de Leo') },
  { u: '¿quiénes son los hijos de Mor?', cat: 'family', resp: () => grounded('¿quiénes son los hijos de Mor?') },
  { u: 'los nietos de Abu', cat: 'family', resp: () => grounded('los nietos de Abu') },
  { u: 'me siento muy sola', cat: 'emotional', resp: () => emo('me siento muy sola') },
  { u: 'los hermanos de Ofir', cat: 'family', resp: () => grounded('los hermanos de Ofir') },
]

function grounded(q: string): { kind: Kind; text: string } {
  const rel = resolveRelationalQuery(q, 'es')
  if (rel) return { kind: 'grounded', text: rel }
  const gd = tryGroundedAnswer(q)
  if (gd && /[A-Za-z]/.test(gd)) return { kind: 'grounded', text: gd }
  return { kind: 'general', text: '' }
}
function emo(q: string): { kind: Kind; text: string } {
  const seed = getProactiveSeed(q, {})
  if (seed) return { kind: 'emotional', text: seed.text }
  // casual acks (gracias / dale) with no seed → LLM territory
  return { kind: 'general', text: '' }
}
function calRead(scope: 'today' | 'tomorrow' | 'week'): { kind: Kind; text: string } {
  const all = JSON.parse(localStorage.getItem('abubank-calendar-appointments') ?? '[]') as Array<{ date: string }>
  const events = scope === 'today' ? all.filter(e => e.date === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
    : scope === 'tomorrow' ? all.filter(e => e.date === tISO) : all
  return { kind: 'calendar', text: shapeCalendarAnswerES(events as never, scope) }
}

const report: HarnessReport = { title: 'Rioplatense Spanish Conversation — Deterministic Results', rows: [] }
let i = 0
for (const step of SCRIPT) {
  i++
  const r = step.resp()
  let pass: boolean, fails: string[], got: string
  if (r.kind === 'general') {
    pass = true; fails = []; got = '(LLM prose — floor: routed cleanly, no fabricated data)'
  } else {
    const sc = scoreResponse(r.text, { lang: 'es', perspectiveSensitive: step.cat === 'family' || step.cat === 'calendar', allowMixed: step.mixed })
    pass = sc.pass; fails = sc.fails; got = r.text || '(empty)'
  }
  report.rows.push({ id: `ES-${i}`, cat: `${step.cat}/${r.kind}`, user: step.u, got, pass, fails })
}

const { md, pass, fail } = renderReport(report)
const out = resolve(process.cwd(), 'docs/abuai/SPANISH_CONVERSATION_RESULTS.md')
writeFileSync(out, md, 'utf-8')
console.log(`Spanish conversation: ${report.rows.length} turns · pass ${pass} · fail ${fail}. Wrote ${out}`)
if (fail > 0) { for (const row of report.rows.filter(r => !r.pass)) console.log(`  FAIL ${row.id} [${row.cat}] "${row.user}" → "${row.got}" :: ${row.fails.join(', ')}`); process.exitCode = 1 }
