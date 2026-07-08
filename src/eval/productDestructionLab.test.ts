/*
 * PRODUCT DESTRUCTION LAB
 * ═══════════════════════════════════════════════════════════════════════════
 * Not unit tests. This drives the REAL production runtime
 * (ExecutiveCognitiveController.handleTurn → runFullTurn → runCognitiveTurn)
 * through HUNDREDS of realistic multi-turn Martita conversations across every
 * domain, threading RuntimeState/conv/createState exactly like index.tsx, and
 * JUDGES every assistant answer for the code-testable failure classes:
 *   wrong intent · lost context · online→calendar/reminder hijack · forced menu
 *   ("באיזה יום?" / "פגישה, יומן, משפחה") · repeated greeting · pending pollution
 *   after exit · false cancel on emotion/audio · memory-recall of a trivial closer
 *   · dropped calendar location · punt-to-LLM where a grounded answer exists.
 *
 * Tools are deterministic stubs: `llm` returns a [LLM] tag so a punt is visible;
 * `online` returns a tagged live answer. That isolates REAL routing/continuity
 * decisions from model text. A failing conversation is written, in full, to
 * docs/eval/PRODUCT_DESTRUCTION_TRANSCRIPTS.md as permanent evidence.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments, loadAppointments, type Appointment } from '../screens/AbuCalendar/service'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'
import { resolvePronouns } from '../screens/AbuAI/pronounResolver'
import { resolveFollowUp } from '../screens/AbuAI/contextResolver'
import type { ChatMessage } from '../screens/AbuAI/types'

// ── in-memory localStorage so the store + focus persist within a conversation ──
class MemoryLocalStorage {
  private s = new Map<string, string>()
  getItem(k: string) { return this.s.has(k) ? this.s.get(k)! : null }
  setItem(k: string, v: string) { this.s.set(k, String(v)) }
  removeItem(k: string) { this.s.delete(k) }
  clear() { this.s.clear() }
  key(i: number) { return [...this.s.keys()][i] ?? null }
  get length() { return this.s.size }
}

const makeTools = (): FullTurnTools => ({
  llm: async (input: string) => `[LLM] ${input.slice(0, 40)}`,
  online: async (q: string) => {
    if (/מזג|אוויר|תחזית|weather|clima/i.test(q)) return { ok: true, answer: `בכפר סבא היום 29 מעלות, שמש. (${q})` }
    if (/משחק|כדורגל|מונדיאל|ליגה|f[uú]tbol/i.test(q)) return { ok: true, answer: `הערב צרפת נגד ברזיל ב-21:00. (${q})` }
    if (/חדשות|news/i.test(q)) return { ok: true, answer: `הכותרת המרכזית היום. (${q})` }
    return { ok: true, answer: `תשובת אונליין: ${q}` }
  },
})

interface TurnLog {
  n: number; say: string; resolved: string; intent: string; source: string
  createPhase: string; sideEffect: unknown; display: string
}
type Judge = (t: TurnLog, log: TurnLog[], convDay: number) => string | null
const PASS: Judge = () => null
interface ConvTurn { say: string; judge?: Judge }
interface Conv { id: string; domain: string; seed?: Appointment[]; turns: ConvTurn[]; postCheck?: (appts: Appointment[]) => string | null }

// ── canonical entities (resolve against the REAL family graph) ──
const FAMILY: Array<{ name: string; g: 'm' | 'f' }> = [
  { name: 'מור', g: 'f' }, { name: 'לאו', g: 'm' }, { name: 'רפי', g: 'm' },
  { name: 'יעל', g: 'f' }, { name: 'אופיר', g: 'f' }, { name: 'נועם', g: 'm' },
  { name: 'גלעד', g: 'm' }, { name: 'עדי', g: 'm' }, { name: 'ירדן', g: 'f' },
]
const DAYS = ['מחר', 'היום', 'ביום ראשון', 'ביום שני', 'ביום שלישי', 'ביום חמישי']
const TIMES = ['בשמונה', 'בתשע', 'בעשר', 'באחת', 'בשלוש', 'בארבע', 'בחמש', 'בשש']
const PLACES = ['בבית', 'בקפה אסתר', 'אצל מור', 'במרפאה', 'בקניון']
const CITIES = ['כפר סבא', 'תל אביב', 'רעננה', 'הרצליה']

const pick = <T,>(arr: T[], i: number): T => arr[i % arr.length]!

// ── reusable judges (conservative — only flag REAL, deterministic failures) ──
const GREETING_RE = /^(?:בוקר טוב|ערב טוב|צהריים טובים|לילה טוב|שלום|היי)\b/u
const FORCED_MENU_RE = /פגישה,?\s*יומן,?\s*משפחה|יומן,?\s*משפחה|באיזה יום\??\s*$/u
const notPunted: Judge = (t) => t.source === 'llm' ? `punt-to-LLM (grounded answer expected) — "${t.display}"` : null
const noForcedMenu: Judge = (t) => FORCED_MENU_RE.test(t.display.trim()) ? `forced menu / "באיזה יום?" — "${t.display}"` : null
const intentOnline: Judge = (t) => t.source !== 'online' ? `expected ONLINE, got ${t.intent}/${t.source} — "${t.display}"` : null
const notCalendarHijack: Judge = (t) => (t.intent === 'calendar_read' || /פגיש|יומן|קבעתי|תזכורת|reminder/.test(t.display)) ? `online→calendar/reminder hijack — ${t.intent} "${t.display}"` : null

function noRepeatedGreeting(log: TurnLog[]): string | null {
  const g = log.filter(t => GREETING_RE.test(t.display.trim()))
  if (g.length >= 2) return `repeated greeting on turns ${g.map(t => t.n).join(',')}`
  return null
}

async function runConversation(c: Conv): Promise<{ log: TurnLog[]; failures: string[] }> {
  ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage()
  saveAppointments(c.seed ?? [])
  const tools = makeTools()
  let state: RuntimeState = IDLE_RUNTIME
  const messages: Array<{ role: string; content: string }> = []
  const log: TurnLog[] = []
  const failures: string[] = []
  const now = new Date('2026-06-24T20:00:00') // Wed, pinned
  const convDay = now.getDate()

  let idc = 0
  for (const turn of c.turns) {
    // Replicate the PRODUCTION entry pipeline (index.tsx): cross-turn pronoun +
    // follow-up resolution run BEFORE the controller. Without this the lab is not
    // faithful — bare "עליה" / "ומחר?" would never be expanded the way they are on
    // the real device.
    const prior: ChatMessage[] = messages.map((m, i) => ({ id: String(i), role: m.role as 'user' | 'assistant', content: m.content, timestamp: 0 }))
    const { resolved: pr } = resolvePronouns(turn.say, prior)
    let eff = pr !== turn.say ? pr : turn.say
    const fu = resolveFollowUp(eff, prior)
    if (fu.wasFollowUp) eff = fu.resolved
    messages.push({ role: 'user', content: eff })
    const seed: RuntimeState = { ...state, conv: state.conv }
    const r = await ExecutiveCognitiveController.handleTurn(seed, eff, { messages: [...messages], now }, tools)
    state = r.state
    messages.push({ role: 'assistant', content: r.display })
    const t: TurnLog = {
      n: log.length + 1, say: turn.say, resolved: eff, intent: r.intent, source: r.source,
      createPhase: r.state.createState.phase, sideEffect: r.sideEffect, display: r.display,
    }
    void idc
    log.push(t)
    if (turn.judge) { const f = turn.judge(t, log, convDay); if (f) failures.push(`T${t.n} "${turn.say}" → ${f}`) }
  }
  const rg = noRepeatedGreeting(log); if (rg) failures.push(rg)
  if (c.postCheck) { const f = c.postCheck(loadAppointments()); if (f) failures.push(f) }
  return { log, failures }
}

// ════════════════════════ CONVERSATION GENERATORS ════════════════════════

function calendarConvs(): Conv[] {
  const out: Conv[] = []
  // create → confirm → read-back  (×  person × day × time × place)
  for (let i = 0; i < 100; i++) {
    const p = pick(FAMILY, i), day = pick(DAYS, i + 1), time = pick(TIMES, i + 2), place = pick(PLACES, i + 3)
    const confirm = pick(['כן', 'כן תקבעי', 'כן אני רוצה מאוד', 'תעשי את זה'], i)
    out.push({
      id: `cal-${i}`, domain: 'calendar', turns: [
        { say: `תקבעי לי פגישה ${day} ${time} עם ${p.name} ${place}`, judge: noForcedMenu },
        { say: confirm, judge: (t) => t.sideEffect !== 'saved_appointment' ? `confirm "${confirm}" did not save (fx=${t.sideEffect}, ${t.intent})` : null },
        { say: 'מה קבעתי מחר?', judge: (t) => t.source === 'llm' ? `read-back punted to LLM — "${t.display}"` : null },
      ],
    })
  }
  return out
}

function onlineConvs(): Conv[] {
  const out: Conv[] = []
  for (let i = 0; i < 100; i++) {
    const city = pick(CITIES, i)
    const topic = pick(['weather', 'sports', 'news'], i)
    const q = topic === 'weather' ? `מה מזג האוויר ב${city}?` : topic === 'sports' ? 'איזה משחקים יש היום?' : 'מה בחדשות היום?'
    out.push({
      id: `online-${i}`, domain: 'online', turns: [
        { say: q, judge: intentOnline },
        // bare temporal follow-up MUST stay online, never flip to the calendar
        { say: 'ומחר?', judge: notCalendarHijack },
      ],
    })
  }
  return out
}

function familyConvs(): Conv[] {
  const out: Conv[] = []
  for (let i = 0; i < 100; i++) {
    const p = pick(FAMILY, i)
    const isWho = i % 3 !== 2
    const q = isWho ? (p.g === 'f' ? `מי זאת ${p.name}?` : `מי זה ${p.name}?`) : `ספרי לי על ${p.name}`
    const pron = p.g === 'f' ? 'עליה' : 'עליו'
    out.push({
      id: `fam-${i}`, domain: 'family', turns: [
        // "מי זה X?" must be grounded (never a cold LLM guess). "ספרי לי על X" may
        // go grounded-LLM (production injects family facts) — not judged as a fail.
        { say: q, judge: isWho ? notPunted : PASS },
        // "(tell me) about her/him" — the follow-up MUST stay on the last person:
        // context retained = the resolver expanded the bare pronoun to that name.
        { say: pron, judge: (t) => t.resolved.includes(p.name) ? null : `lost context: "${pron}" did not resolve to ${p.name} (resolved="${t.resolved}")` },
      ],
    })
  }
  return out
}

function mixedConvs(): Conv[] {
  const out: Conv[] = []
  for (let i = 0; i < 100; i++) {
    const p = pick(FAMILY, i), time = pick(TIMES, i + 1)
    out.push({
      id: `mixed-${i}`, domain: 'mixed', turns: [
        { say: `תקבעי לי פגישה מחר ${time} עם ${p.name}` },
        // family interruption mid-create — must NOT cancel the draft
        { say: `מי זה ${pick(FAMILY, i + 3).name}?`, judge: notPunted },
        { say: 'כן', judge: (t) => t.sideEffect !== 'saved_appointment' ? `resume-after-interruption did not save (fx=${t.sideEffect})` : null },
        { say: 'מה מזג האוויר בכפר סבא?', judge: intentOnline },
        { say: 'ומחר?', judge: notCalendarHijack },
        { say: 'מה דיברנו קודם?', judge: (t) => /דיברנו על (?:עזוב|תודה|ביי|שלום|לא משנה)/.test(t.display) ? `memory recalled a trivial closer — "${t.display}"` : null },
      ],
    })
  }
  return out
}

function emotionalConvs(): Conv[] {
  const out: Conv[] = []
  const feelings = ['אני מרגישה קצת לבד', 'אני משועממת', 'מתגעגעת לפפי', 'אין לי כוח היום', 'אני קצת עצובה']
  for (let i = 0; i < 50; i++) {
    const p = pick(FAMILY, i), time = pick(TIMES, i)
    out.push({
      id: `emo-${i}`, domain: 'emotional', turns: [
        { say: `תקבעי פגישה מחר ${time} עם ${p.name}` },
        // emotional statement mid-create must NOT cold-cancel the draft
        { say: pick(feelings, i), judge: (t) => t.createPhase === 'idle' ? `emotional turn cancelled/lost the draft (phase=idle)` : (/ביטלתי/.test(t.display) ? `false cancel "${t.display}"` : null) },
        { say: 'כן', judge: (t) => t.sideEffect !== 'saved_appointment' ? `draft not saved after emotional aside (fx=${t.sideEffect})` : null },
      ],
    })
  }
  return out
}

function spanishConvs(): Conv[] {
  const out: Conv[] = []
  for (let i = 0; i < 50; i++) {
    out.push({
      id: `es-${i}`, domain: 'spanish', turns: [
        { say: pick(['Hola, ¿cómo estás?', 'Contame algo lindo', '¿Qué tiempo hace en Kfar Saba?', 'Estoy un poco sola'], i) },
        { say: pick(['¿Y mañana?', 'gracias', 'dale'], i) },
      ],
    })
  }
  return out
}

function exitConvs(): Conv[] {
  const out: Conv[] = []
  const exits = ['לא משנה', 'עזוב', 'תצא מזה', 'נעבור לנושא אחר']
  for (let i = 0; i < 30; i++) {
    out.push({
      id: `exit-${i}`, domain: 'exit', turns: [
        { say: `תקבעי תור לרופא ${pick(DAYS, i)} ${pick(TIMES, i)}` },
        { say: pick(exits, i), judge: (t) => t.createPhase !== 'idle' ? `exit did not close the draft (phase=${t.createPhase})` : null },
        { say: 'מה השעה?', judge: (t) => t.createPhase !== 'idle' ? `pending pollution: draft still open (phase=${t.createPhase})` : null },
      ],
    })
  }
  return out
}

function locationConvs(): Conv[] {
  const out: Conv[] = []
  const locs = ['בקפה אסתר', 'בבית של מור', 'במרפאה', 'בקניון ערים']
  for (let i = 0; i < 40; i++) {
    const p = pick(FAMILY, i), time = pick(TIMES, i + 1), loc = pick(locs, i)
    const key = loc.replace(/^ב/, '').split(' ')[0]!
    out.push({
      id: `loc-${i}`, domain: 'calendar-location',
      turns: [
        { say: `תקבעי לי פגישה מחר ${time} עם ${p.name} ${loc}` },
        { say: 'כן', judge: (t) => t.sideEffect !== 'saved_appointment' ? `did not save (fx=${t.sideEffect})` : null },
      ],
      postCheck: (appts) => {
        const ev = appts[appts.length - 1]
        if (!ev) return `no event saved (location "${loc}" case)`
        const hay = `${ev.location ?? ''} ${ev.subject ?? ''} ${ev.notes ?? ''} ${ev.title ?? ''}`
        return hay.includes(key) ? null : `LOCATION DROPPED: "${loc}" not on saved event (loc="${ev.location ?? ''}", title="${ev.title}")`
      },
    })
  }
  return out
}

function calendarPropertyConvs(): Conv[] {
  const out: Conv[] = []
  for (let i = 0; i < 20; i++) {
    const p = pick(FAMILY.filter(f => f.g === 'f'), i) // female → clean names
    out.push({
      id: `calprop-${i}`, domain: 'calendar-property',
      turns: [
        // Create the event via the runtime (robust vs any clock/window filter).
        { say: `תקבעי לי פגישה עם ${p.name} מחר בשלוש בקפה אסתר` },
        { say: 'כן', judge: (t) => t.sideEffect !== 'saved_appointment' ? `setup: did not save (fx=${t.sideEffect})` : null },
        { say: `מתי הפגישה עם ${p.name}?`, judge: (t) => /אין לך/.test(t.display) ? `setup: search did not find the event — "${t.display}"` : noForcedMenu(t, [], 0) },
        // CALENDAR CONTINUITY: a property follow-up must answer FROM the found
        // event, never re-search or punt to the LLM (which loses which event).
        { say: 'באיזה שעה?', judge: (t) => t.source === 'llm' ? `property follow-up "באיזה שעה?" lost the event (punt-to-LLM) — "${t.display}"` : (/15:00|שלוש|שלש/.test(t.display) ? null : `property answer missing the time — "${t.display}"`) },
      ],
    })
  }
  return out
}

function reminderConvs(): Conv[] {
  const out: Conv[] = []
  const tasks = ['לשתות מים', 'לקחת כדור', 'להתקשר ליעל', 'לקנות חלב', 'לצאת לרופא']
  for (let i = 0; i < 30; i++) {
    out.push({
      id: `rem-${i}`, domain: 'reminder',
      turns: [
        // a reminder request must NOT be answered as a live/online lookup
        { say: `תזכירי לי ${pick(tasks, i)} ${pick(['בערב', 'מחר בבוקר', 'בשמונה', 'עוד שעה'], i)}`, judge: (t) => t.source === 'online' ? `reminder became ONLINE — "${t.display}"` : noForcedMenu(t, [], 0) },
      ],
    })
  }
  return out
}

// Directly seeded from Leo's real iPhone failure corpus (docs/eval/*).
function realTranscriptConvs(): Conv[] {
  const out: Conv[] = []
  const realSeeds: ConvTurn[][] = [
    [{ say: 'מתי יש לי פגישה עם מוטי?', judge: noForcedMenu }],
    [{ say: 'מה יש לי היום?', judge: (t) => /רופא|שתיים/.test(t.display) && !/אין/.test(t.display) ? `invented appointment on empty calendar — "${t.display}"` : null }],
    [{ say: 'תקבעי לי פגישה עם אורית היום בשמונה בערב אצלי בבית' }, { say: 'כן', judge: (t) => t.sideEffect !== 'saved_appointment' ? `real EX did not save (fx=${t.sideEffect})` : null }],
    [{ say: 'מי זאת מור?', judge: notPunted }, { say: 'מי זה רפי?', judge: notPunted }],
    [{ say: 'מה מזג האוויר בכפר סבא?', judge: intentOnline }, { say: 'ומחר?', judge: notCalendarHijack }],
    [{ say: 'תקבעי לי פגישה מחר בשלוש עם מוטי' }, { say: 'מתגעגעת לפפי', judge: (t) => t.createPhase === 'idle' ? `emotion cancelled the draft` : null }, { say: 'כן', judge: (t) => t.sideEffect !== 'saved_appointment' ? `not saved after emotion` : null }],
  ]
  for (let i = 0; i < 50; i++) out.push({ id: `real-${i}`, domain: 'real', turns: pick(realSeeds, i) })
  return out
}

// ════════════════════════ THE LAB ════════════════════════

describe('PRODUCT DESTRUCTION LAB — real runtime, hundreds of conversations', () => {
  const convs: Conv[] = [
    ...calendarConvs(), ...onlineConvs(), ...familyConvs(), ...mixedConvs(),
    ...emotionalConvs(), ...spanishConvs(), ...exitConvs(), ...locationConvs(),
    ...reminderConvs(), ...calendarPropertyConvs(), ...realTranscriptConvs(),
  ]
  const results: Array<{ c: Conv; log: TurnLog[]; failures: string[] }> = []

  beforeAll(async () => {
    for (const c of convs) {
      const { log, failures } = await runConversation(c)
      results.push({ c, log, failures })
    }
    // Write the failing transcripts as permanent evidence.
    const failing = results.filter(r => r.failures.length)
    const byCat: Record<string, number> = {}
    for (const r of failing) for (const f of r.failures) { const cat = f.replace(/^T\d+[^→]*→\s*/, '').split(/[—(]/)[0]!.trim(); byCat[cat] = (byCat[cat] ?? 0) + 1 }
    const lines: string[] = ['# PRODUCT DESTRUCTION LAB — failing transcripts', '', `Generated over ${convs.length} conversations. Failing: ${failing.length}.`, '', '## Failures by class', ...Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${v}× ${k}`), '', '## Transcripts']
    for (const r of failing.slice(0, 60)) {
      lines.push('', `### ${r.c.id} (${r.c.domain})`, '```')
      for (const t of r.log) lines.push(`U: ${t.say}`, `A[${t.intent}/${t.source}${t.createPhase !== 'idle' ? ` draft=${t.createPhase}` : ''}${t.sideEffect ? ` fx=${t.sideEffect}` : ''}]: ${t.display}`)
      lines.push('```', ...r.failures.map(f => `- ❌ ${f}`))
    }
    try {
      const p = path.resolve(__dirname, '../../docs/eval/PRODUCT_DESTRUCTION_TRANSCRIPTS.md')
      fs.writeFileSync(p, lines.join('\n'), 'utf8')
    } catch { /* artifact best-effort */ }
    // eslint-disable-next-line no-console
    console.log(`\n[DESTRUCTION_LAB] ${convs.length} conversations · ${failing.length} with failures\n[BY_CLASS] ${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}× ${k}`).join(' · ') || 'none'}\n`)
  }, 120_000)

  it(`ran at least 500 multi-turn conversations`, () => {
    expect(convs.length).toBeGreaterThanOrEqual(500)
  })

  it('the simulated user conversations pass (no code-side failures)', () => {
    const failing = results.filter(r => r.failures.length)
    const detail = failing.slice(0, 40).map(r => `\n[${r.c.id}] ${r.failures.join(' | ')}`).join('')
    expect(failing.length, `${failing.length}/${convs.length} conversations failed:${detail}\n`).toBe(0)
  })
})
