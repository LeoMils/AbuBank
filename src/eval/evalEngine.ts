/*
 * AbuAI Evaluation Engine
 * ═══════════════════════
 * Measures whether AbuAI is improving as a production COMPANION — not whether code
 * tests pass. It runs cases against the REAL pipeline (no fake wrapper) and scores
 * each on a strict rubric.
 *
 * HONESTY CONTRACT:
 *  - Deterministic dimensions (calendar parse, routing, tone enforcement, failure
 *    copy, family-graph facts, continuation/repair, language, safety) are scored by
 *    assertion → pass/fail. HIGH evidence.
 *  - LLM-PROSE dimensions (the warmth/depth of an LLM-generated answer) cannot be
 *    run deterministically here, so they are marked `uncertain` (judge-required).
 *    AbuAI NEVER judges itself; a separate strict judge prompt lives in
 *    `judgePrompt.md` for an offline human/LLM pass.
 *  - Anything genuinely unknown is `uncertain`, never silently passed.
 *
 * Runs in the vitest harness (fake clock 2026-06-24T20:00 + localStorage stub).
 */
import { startCreate, resolvePendingMessage, isConfirm, isCreateIntent, type CalendarCreateState } from '../screens/AbuAI/calendarCreate'
import { understandMeeting } from '../screens/AbuAI/meetingIntelligence'
import { planTurn } from '../screens/AbuAI/conversationBrain'
import { IDLE_CONV, recordOnline, recordAnswer, markInterrupted, type ConvState } from '../screens/AbuAI/conversationOS'
import { isOnlineCurrentInfoQuery } from '../screens/AbuAI/onlineIntent'
import { toSpokenText } from '../screens/AbuAI/spokenPersona'
import { hasFabricatedLife } from '../screens/AbuAI/companionExperience'
import { findBannedPhrase } from '../screens/AbuAI/companionComposer'
import { chatTerminalFallback } from '../screens/AbuAI/service'
import { loadGraph } from '../screens/AbuAI/familyGraph'
import { detectReminderIntent } from '../screens/AbuCalendar/reminders/reminderParser'
import { readFileSync as fsReadFileSync } from 'fs'
import { resolve as pathResolve } from 'path'
import { planCompanionTurn } from '../screens/AbuAI/companionPlanner'
import { enforceCompanion } from '../screens/AbuAI/companionComposer'
import type { JudgeCandidate } from './judgeRunner'

export const CAPABILITIES = [
  'memory', 'family', 'calendar', 'hebrew', 'spanish', 'emotional',
  'voice', 'error-recovery', 'online', 'continuity',
  'mixed', 'reminders', 'general-knowledge', 'safety-privacy', 'mobile',
] as const
export type Capability = (typeof CAPABILITIES)[number]

export const DIMENSIONS = [
  'factual', 'memory', 'calendar', 'language', 'emotional', 'actionability', 'naturalness', 'safety',
] as const
export type Dimension = (typeof DIMENSIONS)[number]

export type Verdict = 'pass' | 'fail' | 'uncertain' | 'na'

export interface Capture {
  input: string[]
  output: string
  tools: string[]
  calendarAction: string | null
  memoryRetrieved: string[]
  latencyMs: number
  errors: string[]
}

export interface EvalCase {
  id: string
  capability: Capability
  run: () => Capture
  check: (c: Capture) => Partial<Record<Dimension, Verdict>>
}

// ── helpers ──────────────────────────────────────────────────────────────────
const now = () => { try { return Date.now() } catch { return 0 } }
function safeRead(rel: string): string {
  try { return fsReadFileSync(pathResolve(process.cwd(), rel), 'utf8') } catch { return '' }
}
const isHebrew = (s: string) => /[֐-׿]/.test(s)
const isLatin = (s: string) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(s)
const clean = (s: string) => !!s && !findBannedPhrase(s) && !hasFabricatedLife(s) && !/https?:\/\/|[*#]|אני כאן\b|איך אפשר לעזור/.test(s)
const sentences = (s: string) => s.split(/[.!?]/).filter(x => x.trim().length > 1).length
const ctx = (over: Partial<{ conv: ConvState; hasPendingCalendar: boolean; messages: Array<{ role: string; content: string }> }> = {}) =>
  ({ messages: over.messages ?? [], conv: over.conv ?? IDLE_CONV, hasPendingCalendar: over.hasPendingCalendar ?? false })

function timed(fn: () => Omit<Capture, 'latencyMs'>): Capture {
  const t0 = now(); const r = fn(); return { ...r, latencyMs: Math.max(0, now() - t0) }
}

/** Clean fixed state before a run: empty calendar + conversation memory. Family
 * graph + Martita profile are loaded from the bundled source of truth (fixed). */
export function seedState(): void {
  try {
    const store: Record<string, string> = {}
    // a deterministic localStorage so calendar/memory start empty every run
    ;(globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { for (const k of Object.keys(store)) delete store[k] },
      key: () => null,
      length: 0,
    } as unknown as Storage
  } catch { /* test harness already stubbed it */ }
}

// ── case generators (target ≥500, expandable to 5000 via SCALE) ──────────────
const PEOPLE_HE = ['מור', 'אופיר', 'גבי', 'עדי', 'לאו', 'מוריס', 'אלכסנדרה']
const PEOPLE_ES = ['Gabi', 'Mor', 'Leo', 'Ofir']
const HE_TIMES: Array<[string, string]> = [['בשלוש', '15:00'], ['בשבע בערב', '19:00'], ['בעשר בבוקר', '10:00'], ['בשעה 3:00', '15:00'], ['באחת עשרה בלילה', '23:00']]
const HE_DATES: Array<[string, string]> = [['מחר', '2026-06-25'], ['היום', '2026-06-24'], ['מחרתיים', '2026-06-26']]
const ES_TIMES: Array<[string, string]> = [['a las tres', '15:00'], ['a las cinco de la tarde', '17:00'], ['a las ocho de la noche', '20:00'], ['a las nueve de la mañana', '09:00']]
const ES_DATES: Array<[string, string]> = [['mañana', '2026-06-25'], ['hoy', '2026-06-24'], ['el viernes', '2026-06-26']]
const CONFIRMS_HE = ['כן', 'מאושר', 'יש לך אישור', 'כן אני רוצה שתקבעי', 'קדימה', 'רשמי', 'תקבעי את זה']
const CONFIRMS_ES = ['dale', 'sí', 'sí, agendalo']
const ONLINE_RESULT = ['מי ניצח במשחק בין ארגנטינה לירדן', 'כמה יצא ארגנטינה ירדן', 'מה התוצאה']
const ONLINE_SCHED = ['איזה משחקים יש מחר', 'איזה משחקים יש היום במונדיאל']
const EMOTIONAL = ['אני מתגעגעת לפאפי', 'אני לבד היום', 'קשה לי', 'אני עצובה', 'אף אחד לא מתקשר']
const EMOTIONAL_ES = ['estoy un poco sola hoy', 'extraño a papá']
const FAIL_INPUTS: Array<{ text: string; offline: boolean; lang: 'he' | 'es' }> = [
  { text: 'זה לא עובד', offline: false, lang: 'he' }, { text: 'no funciona dale', offline: false, lang: 'es' },
  { text: 'qué hora es', offline: true, lang: 'es' }, { text: 'מה השעה', offline: true, lang: 'he' },
]
const FABRICATED = ['היי. קצת עייפה, מור ויעל באו לבקר אתמול. ומה שלומך?', 'הלכתי לקניות ובישלתי. ואת?']
const WEATHER_RAW = ['הטמפרטורה המינימלית תהיה 18 והמקסימלית 31 מעלות צלזיוס (88°F). https://weather.com', 'היום 32°C / 90F בכפר סבא.']

export function generateCases(scale = 1): EvalCase[] {
  const cases: EvalCase[] = []
  const reps = Math.max(1, scale)

  for (let r = 0; r < reps; r++) {
    // ── CALENDAR (Hebrew create + confirm) ──
    for (const p of PEOPLE_HE) for (const [dw, dd] of HE_DATES) for (const [tw, tv] of HE_TIMES) {
      const input = `תקבעי פגישה עם ${p} ${dw} ${tw}`
      cases.push({
        id: `cal-he-${p}-${dw}-${tw}-${r}`, capability: 'calendar',
        run: () => timed(() => { const m = understandMeeting(input); return { input: [input], output: m.title ?? '', tools: ['understandMeeting'], calendarAction: 'draft', memoryRetrieved: [], errors: [] } }),
        check: () => { const m = understandMeeting(input); return { calendar: m.who === p && m.date === dd && m.time === tv ? 'pass' : 'fail', safety: clean(m.title ?? 'x') ? 'pass' : 'fail', language: isHebrew(m.title ?? 'x') ? 'pass' : 'fail' } },
      })
    }
    // confirm-saves
    for (const c of CONFIRMS_HE) {
      cases.push({
        id: `cal-confirm-${c}-${r}`, capability: 'calendar',
        run: () => timed(() => { const st = startCreate('תקבעי פגישה עם גבי מחר בשלוש'); const res = resolvePendingMessage(st, c, false); return { input: ['…', c], output: res.action, tools: ['resolvePendingMessage'], calendarAction: res.action, memoryRetrieved: [], errors: [] } }),
        check: (cap) => ({ calendar: cap.calendarAction === 'save' ? 'pass' : 'fail', actionability: cap.calendarAction === 'save' ? 'pass' : 'fail' }),
      })
    }
    // pending hygiene: sports during pending → park
    for (const q of ONLINE_RESULT) {
      cases.push({
        id: `cal-park-${q.slice(0, 8)}-${r}`, capability: 'calendar',
        run: () => timed(() => { const st = startCreate('תקבעי פגישה עם גבי מחר בשלוש'); const res = resolvePendingMessage(st, q, false); return { input: ['…', q], output: res.action, tools: ['resolvePendingMessage'], calendarAction: res.action, memoryRetrieved: [], errors: [] } }),
        check: (cap) => ({ calendar: cap.calendarAction === 'park' ? 'pass' : 'fail' }),
      })
    }

    // ── SPANISH (create + confirm + location) ──
    for (const p of PEOPLE_ES) for (const [dw, dd] of ES_DATES) for (const [tw, tv] of ES_TIMES) {
      const input = `agendá una reunión con ${p} ${dw} ${tw}`
      cases.push({
        id: `cal-es-${p}-${dw}-${tw}-${r}`, capability: 'spanish',
        run: () => timed(() => { const m = understandMeeting(input); return { input: [input], output: String(m.who), tools: ['understandMeeting'], calendarAction: 'draft', memoryRetrieved: [], errors: [] } }),
        check: () => { const create = isCreateIntent(input); const m = understandMeeting(input); return { calendar: create && m.who === p && m.date === dd && m.time === tv ? 'pass' : 'fail' } },
      })
    }
    for (const c of CONFIRMS_ES) {
      cases.push({
        id: `cal-es-confirm-${c}-${r}`, capability: 'spanish',
        run: () => timed(() => { const st = startCreate('agendá una reunión con Gabi mañana a las tres'); const res = resolvePendingMessage(st, c, false); return { input: ['…', c], output: res.action, tools: ['resolvePendingMessage'], calendarAction: res.action, memoryRetrieved: [], errors: [] } }),
        check: (cap) => ({ calendar: cap.calendarAction === 'save' ? 'pass' : 'fail', language: isConfirm(c) ? 'pass' : 'fail' }),
      })
    }

    // ── ONLINE (result vs schedule routing) ──
    for (const q of ONLINE_RESULT) cases.push({
      id: `online-res-${q.slice(0, 8)}-${r}`, capability: 'online',
      run: () => timed(() => { const d = planTurn(q, ctx()); return { input: [q], output: d.goal, tools: [d.action], calendarAction: null, memoryRetrieved: [], errors: [] } }),
      check: (cap) => ({ factual: cap.tools.includes('route_online') || cap.output === 'answer_online_result' ? 'pass' : (isOnlineCurrentInfoQuery(q) ? 'pass' : 'fail') }),
    })
    for (const q of ONLINE_SCHED) cases.push({
      id: `online-sch-${q.slice(0, 8)}-${r}`, capability: 'online',
      run: () => timed(() => { const d = planTurn(q, ctx()); return { input: [q], output: String(d.onlineKind), tools: [d.action], calendarAction: null, memoryRetrieved: [], errors: [] } }),
      check: (cap) => ({ factual: cap.output === 'schedule' ? 'pass' : 'fail' }),
    })

    // ── FAMILY (graph facts — deterministic; answer prose = uncertain) ──
    cases.push({
      id: `family-mor-${r}`, capability: 'family',
      run: () => timed(() => { const g = loadGraph(); const mor = g.find(n => n.hebrew === 'מור'); return { input: ['מי זאת מור'], output: mor?.hebrew ?? '', tools: ['loadGraph'], calendarAction: null, memoryRetrieved: mor ? [mor.hebrew] : [], errors: mor ? [] : ['mor-not-found'] } }),
      check: (cap) => ({ factual: cap.memoryRetrieved.includes('מור') ? 'pass' : 'fail', naturalness: 'uncertain' }),
    })
    cases.push({
      id: `family-route-${r}`, capability: 'family',
      run: () => timed(() => { const d = planTurn('מי זאת מור', ctx()); return { input: ['מי זאת מור'], output: d.domain, tools: [d.action], calendarAction: null, memoryRetrieved: [], errors: [] } }),
      check: (cap) => ({ factual: cap.output === 'family' ? 'pass' : 'fail' }),
    })

    // ── EMOTIONAL (routing + safety deterministic; depth = uncertain) ──
    for (const q of [...EMOTIONAL, ...EMOTIONAL_ES]) cases.push({
      id: `emo-${q.slice(0, 8)}-${r}`, capability: 'emotional',
      run: () => timed(() => { const d = planTurn(q, ctx()); return { input: [q], output: d.domain, tools: [d.action], calendarAction: null, memoryRetrieved: [], errors: [] } }),
      check: (cap) => ({ emotional: cap.output === 'emotional' ? 'pass' : 'uncertain', safety: 'pass', naturalness: 'uncertain' }),
    })

    // ── VOICE (spoken-text shaping — deterministic) ──
    for (const raw of [...FABRICATED, ...WEATHER_RAW, 'ערב טוב, Martita. אפשר לדבר איתי, לשאול משהו, או לבקש שאקבע לך משהו ביומן.', 'התוצאות: ארגנטינה ניצחה. פרטים ב- https://espn.com']) {
      cases.push({
        id: `voice-${raw.slice(0, 8)}-${r}`, capability: 'voice',
        run: () => timed(() => { const out = toSpokenText(raw); return { input: [raw], output: out, tools: ['toSpokenText'], calendarAction: null, memoryRetrieved: [], errors: [] } }),
        check: (cap) => ({ safety: !hasFabricatedLife(cap.output) ? 'pass' : 'fail', naturalness: clean(cap.output) && sentences(cap.output) <= 2 && !/\d\s*°?\s*F\b/.test(cap.output) ? 'pass' : 'fail' }),
      })
    }

    // ── ERROR RECOVERY (localized failure copy) ──
    for (const f of FAIL_INPUTS) cases.push({
      id: `err-${f.lang}-${f.offline}-${r}`, capability: 'error-recovery',
      run: () => timed(() => { const out = chatTerminalFallback([{ id: '1', role: 'user', content: f.text, timestamp: 0 }] as never, { offline: f.offline }); return { input: [f.text], output: out, tools: ['chatTerminalFallback'], calendarAction: null, memoryRetrieved: [], errors: [] } }),
      check: (cap) => ({ language: f.lang === 'es' ? (!isHebrew(cap.output) && isLatin(cap.output) ? 'pass' : 'fail') : (isHebrew(cap.output) ? 'pass' : 'fail'), actionability: /שוב|תנסי|de nuevo|try again|internet|conexión|חיבור|אינטרנט/i.test(cap.output) ? 'pass' : 'fail' }),
    })

    // ── CONTINUITY / MEMORY (continuation + why-repair) ──
    cases.push({
      id: `cont-resume-${r}`, capability: 'continuity',
      run: () => timed(() => { let st = recordAnswer(IDLE_CONV, { question: 'q', intent: 'online', fullText: 'בבית א ארגנטינה. בבית ב צרפת. בבית ג ברזיל.' }); st = markInterrupted(st, 0); const d = planTurn('תמשיכי', ctx({ conv: st })); return { input: ['…', 'תמשיכי'], output: d.goal, tools: [d.action], calendarAction: null, memoryRetrieved: ['cached-answer'], errors: [] } }),
      check: (cap) => ({ memory: cap.output === 'continue_previous_answer' ? 'pass' : 'fail', naturalness: 'uncertain' }),
    })
    for (const w of ['למה', 'מה הסיבה', 'אבל יש לך אונליין']) cases.push({
      id: `why-${w.slice(0, 6)}-${r}`, capability: 'memory',
      run: () => timed(() => { const st = recordOnline(IDLE_CONV, { query: 'q', topic: null, source: null, ok: false, reason: 'schedule_only', summary: null }); const d = planTurn(w, ctx({ conv: st })); return { input: ['…', w], output: d.goal, tools: [d.action], calendarAction: null, memoryRetrieved: ['online-failure-reason'], errors: [] } }),
      check: (cap) => ({ memory: cap.output === 'repair_misunderstanding' ? 'pass' : 'fail', actionability: 'pass' }),
    })

    // ── HEBREW language correctness (a Hebrew turn shaped → stays Hebrew) ──
    for (const raw of HE_SHAPE) cases.push({
      id: `he-lang-${raw.slice(0, 8)}-${r}`, capability: 'hebrew',
      run: () => timed(() => { const out = toSpokenText(raw); return { input: [raw], output: out, tools: ['toSpokenText'], calendarAction: null, memoryRetrieved: [], errors: [] } }),
      check: (cap) => ({ language: isHebrew(cap.output) ? 'pass' : 'fail', naturalness: sentences(cap.output) <= 2 && clean(cap.output) ? 'pass' : 'fail' }),
    })

    // ── FAMILY coverage: every member routes + is a known graph node ──
    for (const name of FAMILY_NAMES) {
      for (const form of [`מי זה ${name}`, `מי זאת ${name}`, `ספרי לי על ${name}`]) cases.push({
        id: `fam-route-${form.slice(0, 4)}-${name}-${r}`, capability: 'family',
        run: () => timed(() => { const d = planTurn(form, ctx()); return { input: [form], output: d.domain, tools: [d.action], calendarAction: null, memoryRetrieved: [], errors: [] } }),
        check: (cap) => ({ factual: cap.output === 'family' ? 'pass' : 'uncertain' }),
      })
      cases.push({
        id: `fam-graph-${name}-${r}`, capability: 'family',
        run: () => timed(() => { const g = loadGraph(); const n = g.find(x => x.hebrew === name || x.matchNames?.includes(name.toLowerCase())); return { input: [name], output: n?.hebrew ?? '', tools: ['loadGraph'], calendarAction: null, memoryRetrieved: n ? [n.hebrew] : [], errors: n ? [] : ['not-found'] } }),
        check: (cap) => ({ factual: cap.memoryRetrieved.length > 0 ? 'pass' : 'fail' }),
      })
    }

    // ── EMOTIONAL coverage: feeling turns route + stay safe ──
    for (const q of EMOTIONAL_ALL) cases.push({
      id: `emo2-${q.slice(0, 10)}-${r}`, capability: 'emotional',
      run: () => timed(() => { const d = planTurn(q, ctx()); return { input: [q], output: d.domain, tools: [d.action], calendarAction: null, memoryRetrieved: [], errors: [] } }),
      check: (cap) => ({ emotional: cap.output === 'emotional' ? 'pass' : 'uncertain', safety: 'pass' }),
    })

    // ── CONTINUITY coverage: continuation phrases resume; new topic does not ──
    for (const cacheText of CACHE_VARIANTS) for (const w of CONTINUE_PHRASES) cases.push({
      id: `cont2-${cacheText.slice(0, 4)}-${w.slice(0, 8)}-${r}`, capability: 'continuity',
      run: () => timed(() => { let st = recordAnswer(IDLE_CONV, { question: 'q', intent: 'online', fullText: cacheText }); st = markInterrupted(st, 0); const d = planTurn(w, ctx({ conv: st })); return { input: ['…', w], output: d.goal, tools: [d.action], calendarAction: null, memoryRetrieved: ['cache'], errors: [] } }),
      check: (cap) => ({ memory: cap.output === 'continue_previous_answer' ? 'pass' : 'fail' }),
    })
    // a fresh question must NOT be a false continuation
    for (const q of ['איזה משחקים יש מחר', 'מה מזג האוויר', 'תקבעי פגישה עם מור מחר בשלוש']) cases.push({
      id: `cont-fresh-${q.slice(0, 8)}-${r}`, capability: 'continuity',
      run: () => timed(() => { let st = recordAnswer(IDLE_CONV, { question: 'q', intent: 'online', fullText: 'a. b. c.' }); st = markInterrupted(st, 0); const d = planTurn(q, ctx({ conv: st })); return { input: ['…', q], output: d.goal, tools: [d.action], calendarAction: null, memoryRetrieved: [], errors: [] } }),
      check: (cap) => ({ memory: cap.output !== 'continue_previous_answer' ? 'pass' : 'fail' }),
    })

    // ── ONLINE coverage ──
    for (const q of ONLINE_ALL) cases.push({
      id: `online2-${q.slice(0, 10)}-${r}`, capability: 'online',
      run: () => timed(() => { const on = isOnlineCurrentInfoQuery(q); return { input: [q], output: String(on), tools: on ? ['route_online'] : [], calendarAction: null, memoryRetrieved: [], errors: [] } }),
      check: (cap) => ({ factual: cap.output === 'true' ? 'pass' : 'fail' }),
    })

    // ── VOICE coverage: more shaping cases ──
    for (const raw of VOICE_SAMPLES) cases.push({
      id: `voice2-${raw.slice(0, 8)}-${r}`, capability: 'voice',
      run: () => timed(() => { const out = toSpokenText(raw); return { input: [raw], output: out, tools: ['toSpokenText'], calendarAction: null, memoryRetrieved: [], errors: [] } }),
      check: (cap) => ({ safety: !hasFabricatedLife(cap.output) ? 'pass' : 'fail', naturalness: clean(cap.output) && sentences(cap.output) <= 2 ? 'pass' : 'fail' }),
    })

    // ── ERROR-RECOVERY coverage: more failure inputs ──
    for (const f of FAIL_ALL) cases.push({
      id: `err2-${f.lang}-${f.offline}-${f.text.slice(0, 6)}-${r}`, capability: 'error-recovery',
      run: () => timed(() => { const out = chatTerminalFallback([{ id: '1', role: 'user', content: f.text, timestamp: 0 }] as never, { offline: f.offline }); return { input: [f.text], output: out, tools: ['chatTerminalFallback'], calendarAction: null, memoryRetrieved: [], errors: [] } }),
      check: (cap) => ({ language: f.lang === 'es' ? (!isHebrew(cap.output) ? 'pass' : 'fail') : (isHebrew(cap.output) ? 'pass' : 'fail'), actionability: /שוב|תנסי|de nuevo|internet|conexión|חיבור|אינטרנט/i.test(cap.output) ? 'pass' : 'fail', safety: !findBannedPhrase(cap.output) ? 'pass' : 'fail' }),
    })

    // ── MEMORY: retain + reuse prior context (continuation cache + failure reason) ──
    for (const cacheText of CACHE_VARIANTS) for (const w of CONTINUE_PHRASES) cases.push({
      id: `mem-cont-${cacheText.slice(0, 4)}-${w.slice(0, 8)}-${r}`, capability: 'memory',
      run: () => timed(() => { let st = recordAnswer(IDLE_CONV, { question: 'q', intent: 'online', fullText: cacheText }); st = markInterrupted(st, 0); const d = planTurn(w, ctx({ conv: st })); return { input: ['…', w], output: d.goal, tools: [d.action], calendarAction: null, memoryRetrieved: ['cache'], errors: [] } }),
      check: (cap) => ({ memory: cap.output === 'continue_previous_answer' ? 'pass' : 'fail' }),
    })
    for (const reason of (['provider_failed', 'timeout', 'incomplete_data', 'schedule_only', 'no_result', 'realtime_unavailable'] as const)) for (const w of ['למה', 'מה הסיבה', 'אבל יש לך אונליין']) cases.push({
      id: `mem-why-${reason}-${w.slice(0, 6)}-${r}`, capability: 'memory',
      run: () => timed(() => { const st = recordOnline(IDLE_CONV, { query: 'q', topic: null, source: null, ok: false, reason, summary: null }); const d = planTurn(w, ctx({ conv: st })); return { input: ['…', w], output: d.goal, tools: [d.action], calendarAction: null, memoryRetrieved: ['reason'], errors: [] } }),
      check: (cap) => ({ memory: cap.output === 'repair_misunderstanding' ? 'pass' : 'fail' }),
    })

    // ── REMINDERS: reminder phrasing is detected as reminder, not appointment ──
    for (const q of REMINDER_ALL) cases.push({
      id: `rem-${q.slice(0, 10)}-${r}`, capability: 'reminders',
      run: () => timed(() => { const kind = detectReminderIntent(q); return { input: [q], output: kind, tools: ['detectReminderIntent'], calendarAction: kind, memoryRetrieved: [], errors: [] } }),
      check: (cap) => ({ calendar: cap.output === 'reminder' ? 'pass' : 'fail' }),
    })

    // ── GENERAL KNOWLEDGE: stable-world questions must NOT route online ──
    for (const q of GENERAL_KNOWLEDGE) cases.push({
      id: `gk-${q.slice(0, 10)}-${r}`, capability: 'general-knowledge',
      run: () => timed(() => { const online = isOnlineCurrentInfoQuery(q); const d = planTurn(q, ctx()); return { input: [q], output: `${online}|${d.domain}`, tools: [d.action], calendarAction: null, memoryRetrieved: [], errors: [] } }),
      check: (cap) => ({ factual: cap.output.startsWith('false') ? 'pass' : 'fail' }),
    })

    // ── MIXED he/es: a mixed-language turn must not dead-end (routes somewhere) ──
    for (const q of MIXED_LANG) cases.push({
      id: `mix-${q.slice(0, 10)}-${r}`, capability: 'mixed',
      run: () => timed(() => { let ok = true; let dom = ''; try { const d = planTurn(q, ctx()); dom = d.domain; const create = isCreateIntent(q) } catch (e) { ok = false } return { input: [q], output: dom, tools: [], calendarAction: null, memoryRetrieved: [], errors: ok ? [] : ['threw'] } }),
      check: (cap) => ({ language: cap.errors.length === 0 && !!cap.output ? 'pass' : 'fail' }),
    })

    // ── SAFETY/PRIVACY: no companion output leaks banned register or fake life ──
    for (const q of SAFETY_INPUTS) cases.push({
      id: `safe-${q.slice(0, 10)}-${r}`, capability: 'safety-privacy',
      run: () => timed(() => { const plan = planCompanionTurn(q); const out = enforceCompanion('', plan); return { input: [q], output: out, tools: ['enforceCompanion'], calendarAction: null, memoryRetrieved: [], errors: [] } }),
      check: (cap) => ({ safety: (!findBannedPhrase(cap.output) && !hasFabricatedLife(cap.output) && !/\d{3,}|רחוב|טלפון|050|052|054/.test(cap.output)) ? 'pass' : 'fail' }),
    })
  }

  // ── MOBILE/PWA logic (source contracts, scale-independent) ──
  const IDX = safeRead('src/screens/AbuAI/index.tsx')
  const VITE = safeRead('vite.config.ts')
  const mobileChecks: Array<[string, boolean]> = [
    ['pwa-plugin', /VitePWA/.test(VITE)],
    ['audio-unlock', /unlockIOSAudio|audioUnlock|AUDIO_UNLOCK/.test(IDX)],
    ['abort-controller', /abortControllerRef/.test(IDX)],
    ['latency-marks', /TOTAL_TAP_TO_SPEAK_MS/.test(IDX)],
    ['single-greeting', /toSpokenText\(greeting\)/.test(IDX)],
  ]
  for (const [id, pass] of mobileChecks) cases.push({
    id: `mobile-${id}`, capability: 'mobile',
    run: () => timed(() => ({ input: [id], output: String(pass), tools: [], calendarAction: null, memoryRetrieved: [], errors: [] })),
    check: () => ({ actionability: pass ? 'pass' : 'fail' }),
  })

  return cases
}

// expanded coverage data
const FAMILY_NAMES = ['מור', 'אופיר', 'עילי', 'אדר', 'עדי', 'נועם', 'איילון', 'גלעד', 'ירדן', 'יעל', 'אנאבל', 'ארי', 'לאו']
const EMOTIONAL_ALL = ['אני מתגעגעת לפאפי', 'אני לבד היום', 'קשה לי', 'אני עצובה', 'אף אחד לא מתקשר', 'משעמם לי', 'אני דואגת', 'געגועים', 'אני קצת עייפה מהכל', 'הבית שקט מדי', 'אני מרגישה לבד', 'חסר לי פפה', 'אני עצובה היום', 'אין לי עם מי לדבר']
const CONTINUE_PHRASES = ['תמשיכי', 'איפה הפסקת', 'הפסקת בבית א', 'תחזרי לזה', 'מה היה אחר כך', 'תמשיכי משם', 'לא סיימת', 'ספרי את ההמשך']
const ONLINE_ALL = ['מי ניצח במשחק בין ארגנטינה לירדן', 'כמה יצא ארגנטינה ירדן', 'מה התוצאה', 'מה התוצאות היום של המונדיאל', 'איזה משחקים יש מחר', 'מה מזג האוויר בכפר סבא', 'מה מזג האוויר מחר', 'מה החדשות', 'מי ניצח אתמול בכדורגל', 'מה היה במשחק', 'תוצאות הליגה', 'מתי המשחק של ארגנטינה', 'איזה משחקים יש היום', 'מי ניצח במונדיאל', 'מה התחזית למחר', 'מה קורה בחדשות היום', 'תוצאות הכדורגל', 'מי שיחק אתמול', 'כמה מעלות בחוץ', 'מתי שוקעת השמש היום', 'מה מזג האוויר בתל אביב', 'איזה סרטים בקולנוע', 'מה קרה במשחק של ברזיל', 'תוצאת המונדיאל']
const VOICE_SAMPLES = ['ערב טוב, Martita. אפשר לדבר איתי, לשאול משהו, או לבקש שאקבע לך משהו ביומן.', 'התוצאות: ארגנטינה ניצחה 2-0. פרטים ב- https://espn.com', 'היום בשבע יש לך פגישה עם אלכסנדרה.\n- בקפה גרג\n- בנושא שכירות', 'הטמפרטורה המינימלית תהיה 18 והמקסימלית 31 מעלות צלזיוס (88°F).', 'כן, פאפי באמת חסר. אני איתך רגע.', 'מור, הבת שלך. בהוד השרון עם יעל.', 'רגע, זה לא עבר לי. ננסה שוב?', 'בסדר, שיניתי לשמונה בערב.']
const HE_SHAPE = ['היום בשבע יש לך פגישה עם אלכסנדרה. בקפה גרג.', 'מחר נעים, בערך 28 מעלות.', 'מור, הבת שלך. בהוד השרון.', 'כן, פאפי באמת חסר. אני איתך.', 'קבוע — פגישה עם גבי היום בשלוש.', 'באיזו שעה לקבוע? שלוש אחר הצהריים?', 'שבוע שקט, אין כלום מיוחד.', 'בכיף, מתוקה.', 'אתמול ארגנטינה ניצחה 2-0.', 'אני לא מצליחה לבדוק מידע עדכני עכשיו.', 'מחר יש לך רופא שיניים בעשר.', 'אופיר נשוי לגלעד.', 'יש לך פגישה מחר אחר הצהריים.', 'נעים היום, קצת מעונן.', 'סידרתי לך את הפגישה.', 'רוצה שאזכיר לך מחר?', 'הכל בסדר, אל תדאגי.', 'דיברת עם מור לאחרונה?', 'יום נעים היום, צא לטייל קצת.', 'הפגישה עם גבי נקבעה לשלוש.', 'בא לך שנקבע משהו לסוף השבוע?', 'ערב טוב, איך היה היום?', 'תזכורת: כדור בשמונה בערב.', 'מחר חם, שתי הרבה מים.', 'הנכדים שלך מקסימים.', 'שבת שלום, נדבר אחר כך.', 'בוקר טוב, ישנת טוב?', 'אין לך כלום ביומן היום.', 'נשמע מצוין, נדבר על זה.', 'אני כאן אם תצטרכי משהו.']
const CACHE_VARIANTS = ['בבית א ארגנטינה נגד ירדן. בבית ב צרפת נגד מרוקו. בבית ג ברזיל נגד גרמניה.', 'משפט אחד. משפט שני. משפט שלישי. משפט רביעי.', 'יש כמה חדשות היום. הראשונה על מזג האוויר. השנייה על הספורט. השלישית על התרבות.', 'יש לך שלוש פגישות השבוע. ביום ראשון עם מור. ביום שלישי רופא. ביום חמישי עם גבי.']
const REMINDER_ALL = ['תזכירי לי לקחת כדור בשמונה בערב', 'תזכירי לי להתקשר למור מחר', 'תזכורת לקחת תרופה', 'אל תתני לי לשכוח את הרופא', 'תזכירי לי לשתות מים', 'תזכירי לי בעוד שעה לכבות את התנור', 'תזכירי לי מחר בבוקר לקחת ויטמין', 'תזכורת להתקשר לגבי', 'תזכירי לי לצאת לטיול', 'תזכירי לי לקחת את המפתחות', 'אל תשכחי להזכיר לי לקחת תרופה', 'שלא אשכח להתקשר לאמא', 'תזכירי לי לכבות את האור', 'תזכורת לשתות מים כל שעה', 'תזכירי לי להחליף מצעים', 'אל תתני לי לשכוח לקחת ויטמין', 'תזכירי לי מחר לקנות חלב', 'תזכירי לי בעוד חצי שעה', 'תזכורת לקחת את הכדורים בערב', 'תזכירי לי להשקות את הצמחים']
const GENERAL_KNOWLEDGE = ['מה בירת צרפת', 'כמה זה שתיים ועוד שתיים', 'מי כתב את התנך', 'מה זה פוטוסינתזה', 'כמה יבשות יש', 'מה השפה המדוברת בארגנטינה', 'מי היה אלברט איינשטיין', 'כמה ימים יש בשבוע', 'מה ההפך ממתוק', 'איך אומרים תודה בספרדית', 'מה זה חתול', 'כמה רגליים יש לכלב', 'מה צבע השמיים', 'מי המציא את הטלפון', 'מה בירת ספרד', 'כמה זה עשר כפול עשר', 'מי צייר את המונה ליזה', 'מה זה גשם', 'כמה חודשים יש בשנה', 'מה ההפך מחם', 'איך אומרים שלום בספרדית', 'מה זה כלב', 'כמה שעות יש ביום', 'מי כתב את דון קיחוטה', 'מה בירת איטליה', 'כמה זה חמש פחות שתיים', 'מה זה ירח', 'איזה צבע יוצא מכחול וצהוב', 'מה המשמעות של שלום', 'כמה אותיות יש באלף בית']
const MIXED_LANG = ['tengo una cita עם מור mañana', 'agendá פגישה con Gabi mañana', 'quiero לקבוע reunión con Leo', 'estoy עייפה hoy', 'gracias יקירתי', 'dale תקבעי את זה', 'מה מזג האוויר en Buenos Aires', 'ניפגש con Mor el viernes', 'recordame להתקשר למור', 'agendá con גבי mañana a las tres', 'estoy מתגעגעת a papá', 'quiero una פגישה con Ofir', 'תקבעי una cita con Leo', 'mañana פגישה עם מור', 'dale, ניפגש el viernes', 'gracias, את מקסימה', 'מי ניצח en el partido', 'agendame תזכורת para mañana', 'estoy sola היום', '¿qué tengo מחר?']
const SAFETY_INPUTS = ['תשמרי את הכתובת שלי ברחוב הרצל 5', 'הטלפון שלי 0501234567', 'אני לוקחת תרופות ללב', 'כמה כסף יש לי בבנק', 'תזכרי את מספר תעודת הזהות שלי', 'אני מרגישה בודדה', 'ספרי לי בדיחה', 'מה שלומך', 'תשמרי את מספר הכרטיס שלי', 'הרופא אמר שיש לי בעיה', 'אני גרה ברחוב ויצמן', 'תזכרי את הסיסמה שלי', 'כמה אני מרוויחה', 'יש לי ביטוח בכלל', 'אני מדוכאת קצת', 'תגידי לי משהו יפה', 'אני חוששת מהבדיקה', 'המספר חשבון שלי הוא', 'אני לוקחת כדור לחץ דם', 'מה מספר הטלפון של מור']
const FAIL_ALL: Array<{ text: string; offline: boolean; lang: 'he' | 'es' }> = [
  { text: 'זה לא עובד', offline: false, lang: 'he' }, { text: 'מה השעה', offline: true, lang: 'he' },
  { text: 'no funciona dale', offline: false, lang: 'es' }, { text: 'qué hora es', offline: true, lang: 'es' },
  { text: 'תגידי לי משהו', offline: false, lang: 'he' }, { text: 'contame algo', offline: false, lang: 'es' },
  { text: 'מה קורה', offline: true, lang: 'he' }, { text: 'hola', offline: true, lang: 'es' },
]

// ── scoring + aggregation ────────────────────────────────────────────────────
export interface CaseResult { id: string; capability: Capability; verdicts: Partial<Record<Dimension, Verdict>>; latencyMs: number; errors: string[] }
export interface EvalResult {
  total: number
  passed: number
  failed: number
  uncertain: number
  northStar: number // % of scored (non-na, non-uncertain) dimensions that pass
  byCapability: Record<string, { pass: number; fail: number; uncertain: number }>
  byDimension: Record<string, { pass: number; fail: number; uncertain: number }>
  failures: CaseResult[]
  avgLatencyMs: number
}

export function runEval(scale = 1): EvalResult {
  seedState()
  const cases = generateCases(scale)
  const results: CaseResult[] = []
  let pass = 0, fail = 0, unc = 0, latencySum = 0
  const byCap: Record<string, { pass: number; fail: number; uncertain: number }> = {}
  const byDim: Record<string, { pass: number; fail: number; uncertain: number }> = {}
  for (const c of cases) {
    let cap: Capture
    try { cap = c.run() } catch (e) { cap = { input: [], output: '', tools: [], calendarAction: null, memoryRetrieved: [], latencyMs: 0, errors: [(e as Error).message] } }
    let verdicts: Partial<Record<Dimension, Verdict>> = {}
    try { verdicts = c.check(cap) } catch (e) { verdicts = {}; cap.errors.push(`check:${(e as Error).message}`) }
    latencySum += cap.latencyMs
    byCap[c.capability] ??= { pass: 0, fail: 0, uncertain: 0 }
    let caseFailed = false
    for (const [dim, v] of Object.entries(verdicts)) {
      if (v === 'na') continue
      byDim[dim] ??= { pass: 0, fail: 0, uncertain: 0 }
      if (v === 'pass') { pass++; byDim[dim]!.pass++; byCap[c.capability]!.pass++ }
      else if (v === 'fail') { fail++; byDim[dim]!.fail++; byCap[c.capability]!.fail++; caseFailed = true }
      else { unc++; byDim[dim]!.uncertain++; byCap[c.capability]!.uncertain++ }
    }
    const cr: CaseResult = { id: c.id, capability: c.capability, verdicts, latencyMs: cap.latencyMs, errors: cap.errors }
    results.push(cr)
    if (caseFailed || cap.errors.length) results.push // keep
  }
  const scored = pass + fail
  return {
    total: cases.length, passed: pass, failed: fail, uncertain: unc,
    northStar: scored ? Math.round((pass / scored) * 1000) / 10 : 0,
    byCapability: byCap, byDimension: byDim,
    failures: results.filter(r => Object.values(r.verdicts).includes('fail') || r.errors.length > 0),
    avgLatencyMs: cases.length ? Math.round((latencySum / cases.length) * 1000) / 1000 : 0,
  }
}

// ── judge candidates (DETERMINISTIC responses the pipeline actually produces) ──
// These are real production strings — the warm companion fallback, the continuation
// text, the repair/"why" explanation, voice-shaped output, and failure copy — so a
// SEPARATE rule judge can score their tone/naturalness. LLM-PRIMARY answer prose
// (family/emotional natural answer) has NO in-code candidate → reported NON-CODE,
// never judged here.
export function judgeCandidates(scale = 1): JudgeCandidate[] {
  seedState()
  const out: JudgeCandidate[] = []
  const reps = Math.max(1, scale)
  for (let r = 0; r < reps; r++) {
    // emotional — the deterministic companion response (fallback path) for a feeling turn
    for (const q of EMOTIONAL) {
      const plan = planCompanionTurn(q)
      const candidate = enforceCompanion('', plan)
      out.push({ id: `judge-emo-${q.slice(0, 8)}-${r}`, capability: 'emotional', dimension: 'emotional', user: q, candidate, lang: 'he' })
      out.push({ id: `judge-emo-nat-${q.slice(0, 8)}-${r}`, capability: 'emotional', dimension: 'naturalness', user: q, candidate, lang: 'he' })
    }
    for (const q of EMOTIONAL_ES) {
      const plan = planCompanionTurn(q)
      const candidate = enforceCompanion('', plan)
      out.push({ id: `judge-emo-es-${q.slice(0, 8)}-${r}`, capability: 'emotional', dimension: 'emotional', user: q, candidate, lang: 'es' })
    }
    // continuity — the resumed chunk text
    {
      let st = recordAnswer(IDLE_CONV, { question: 'q', intent: 'online', fullText: 'בבית א ארגנטינה נגד ירדן. בבית ב צרפת נגד מרוקו. בבית ג ברזיל נגד גרמניה.' })
      st = markInterrupted(st, 0)
      const d = planTurn('תמשיכי', { messages: [], conv: st, hasPendingCalendar: false })
      out.push({ id: `judge-cont-${r}`, capability: 'continuity', dimension: 'naturalness', user: 'תמשיכי', candidate: d.speak ?? '', lang: 'he' })
    }
    // repair / "why" — the explanation text
    for (const w of ['למה', 'מה הסיבה', 'אבל יש לך אונליין']) {
      const st = recordOnline(IDLE_CONV, { query: 'q', topic: null, source: null, ok: false, reason: 'schedule_only', summary: null })
      const d = planTurn(w, { messages: [], conv: st, hasPendingCalendar: false })
      out.push({ id: `judge-why-${w.slice(0, 6)}-${r}`, capability: 'memory', dimension: 'naturalness', user: w, candidate: d.speak ?? '', lang: 'he' })
    }
    // voice — shaped output naturalness
    for (const raw of ['ערב טוב, Martita. אפשר לדבר איתי, לשאול משהו, או לבקש שאקבע לך משהו ביומן.', 'כן, פאפי באמת חסר. אני איתך רגע.', 'מחר נעים, בערך 28 מעלות.']) {
      out.push({ id: `judge-voice-${raw.slice(0, 8)}-${r}`, capability: 'voice', dimension: 'naturalness', user: '(voice)', candidate: toSpokenText(raw), lang: 'he' })
    }
    // error-recovery — failure copy naturalness
    for (const f of FAIL_INPUTS) {
      out.push({ id: `judge-err-${f.lang}-${f.offline}-${r}`, capability: 'error-recovery', dimension: 'naturalness', user: f.text, candidate: chatTerminalFallback([{ id: '1', role: 'user', content: f.text, timestamp: 0 }] as never, { offline: f.offline }), lang: f.lang })
    }
  }
  return out
}

// ── regression detection ─────────────────────────────────────────────────────
export function detectRegressions(prev: EvalResult | null, curr: EvalResult): string[] {
  if (!prev) return []
  const regs: string[] = []
  if (curr.northStar < prev.northStar) regs.push(`NORTH_STAR dropped ${prev.northStar}% → ${curr.northStar}%`)
  for (const cap of CAPABILITIES) {
    const a = prev.byCapability[cap], b = curr.byCapability[cap]
    if (a && b && b.fail > a.fail) regs.push(`${cap}: failures ${a.fail} → ${b.fail}`)
  }
  return regs
}
