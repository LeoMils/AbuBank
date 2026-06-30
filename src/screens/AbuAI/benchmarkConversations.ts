/*
 * BENCHMARK_CONVERSATIONS
 * ═══════════════════════
 * The NORTH_STAR metric, runnable. Each scenario is a real user-moment (from
 * Leo's device transcripts + the companion spec). `runBenchmarks()` executes the
 * ACTUAL pipeline functions and returns a score = % of moments that behave
 * correctly. This is the number every war-room cycle tries to raise.
 *
 * Pure logic; the test harness provides the environment (fake clock anchored to
 * 2026-06-24T20:00 + localStorage stub). HIGH evidence: it runs the code, not greps.
 */
import { startCreate, resolvePendingMessage, isConfirm, isCreateIntent } from './calendarCreate'
import { understandMeeting } from './meetingIntelligence'
import { planTurn } from './conversationBrain'
import { IDLE_CONV, recordOnline, recordAnswer, markInterrupted, type ConvState } from './conversationOS'
import { isOnlineCurrentInfoQuery } from './onlineIntent'
import { toSpokenText } from './spokenPersona'
import { hasFabricatedLife } from './companionExperience'
import { findBannedPhrase } from './companionComposer'
import { chatTerminalFallback } from './service'

const TODAY = '2026-06-24'
const ctx = (over: Partial<{ conv: ConvState; hasPendingCalendar: boolean; messages: Array<{ role: string; content: string }> }> = {}) =>
  ({ messages: over.messages ?? [], conv: over.conv ?? IDLE_CONV, hasPendingCalendar: over.hasPendingCalendar ?? false })
const clean = (s: string | null | undefined): boolean =>
  !!s && !findBannedPhrase(s) && !hasFabricatedLife(s) && !/https?:\/\/|[*#]|אני כאן\b|איך אפשר לעזור/.test(s)

export interface Scenario { id: string; category: string; run: () => boolean }

export const SCENARIOS: Scenario[] = [
  // ── Calendar ──────────────────────────────────────────────────────────────
  { id: 'cal-3pm-not-3am', category: 'calendar', run: () => understandMeeting('פגישה ביומן להיום בשעה 3:00 עם גבי').time === '15:00' },
  { id: 'cal-3pm-who', category: 'calendar', run: () => understandMeeting('פגישה ביומן להיום בשעה 3:00 עם גבי').who === 'גבי' },
  { id: 'cal-3pm-clean-title', category: 'calendar', run: () => understandMeeting('פגישה ביומן להיום בשעה 3:00 עם גבי').title === 'פגישה עם גבי' },
  { id: 'cal-night-explicit', category: 'calendar', run: () => understandMeeting('תקבעי עם גבי מחר בשעה 3:00 בלילה').time === '03:00' },
  { id: 'cal-confirm-ken', category: 'calendar', run: () => resolvePendingMessage(startCreate('תקבעי פגישה עם גבי מחר בשלוש'), 'כן', false).action === 'save' },
  { id: 'cal-confirm-meushar', category: 'calendar', run: () => resolvePendingMessage(startCreate('תקבעי פגישה עם גבי מחר בשלוש'), 'מאושר', false).action === 'save' },
  { id: 'cal-confirm-yesh-ishur', category: 'calendar', run: () => resolvePendingMessage(startCreate('תקבעי פגישה עם גבי מחר בשלוש'), 'יש לך אישור', false).action === 'save' },
  { id: 'cal-confirm-long', category: 'calendar', run: () => resolvePendingMessage(startCreate('תקבעי פגישה עם גבי מחר בשלוש'), 'כן אני רוצה שתקבעי את זה', false).action === 'save' },
  { id: 'cal-loc-merge-cafe', category: 'calendar', run: () => { const r = resolvePendingMessage(startCreate('תקבעי פגישה עם גבי מחר בשלוש'), 'בבית קפה מרוקו', false); return r.action === 'update' && !!r.state.draft.location?.includes('מרוקו') } },
  { id: 'cal-loc-merge-home', category: 'calendar', run: () => resolvePendingMessage(startCreate('תקבעי פגישה עם גבי מחר בשלוש'), 'בבית', false).action === 'update' },
  { id: 'cal-loc-merge-atzel', category: 'calendar', run: () => resolvePendingMessage(startCreate('תקבעי פגישה עם גבי מחר בשלוש'), 'אצל גבי', false).action === 'update' },
  { id: 'cal-no-pollution-sports', category: 'calendar', run: () => resolvePendingMessage(startCreate('תקבעי פגישה עם גבי מחר בשלוש'), 'מי ניצח במשחק בין ארגנטינה לירדן', false).action === 'park' },
  { id: 'cal-no-pollution-weather', category: 'calendar', run: () => resolvePendingMessage(startCreate('תקבעי פגישה עם גבי מחר בשלוש'), 'מה מזג האוויר בכפר סבא', false).action === 'park' },
  { id: 'cal-no-false-cancel', category: 'calendar', run: () => resolvePendingMessage(startCreate('תקבעי פגישה עם גבי מחר בשלוש'), 'לא', false).action !== 'save' },
  { id: 'cal-tomorrow-evening', category: 'calendar', run: () => understandMeeting('תקבעי עם מור מחר בערב בשבע').date === '2026-06-25' },

  // ── Online ────────────────────────────────────────────────────────────────
  { id: 'online-arg-jordan-online', category: 'online', run: () => planTurn('מי ניצח במשחק בין ארגנטינה לירדן', ctx()).domain === 'online' },
  { id: 'online-arg-jordan-result', category: 'online', run: () => planTurn('מי ניצח במשחק בין ארגנטינה לירדן', ctx()).goal === 'answer_online_result' },
  { id: 'online-kama-yatza', category: 'online', run: () => planTurn('כמה יצא ארגנטינה ירדן', ctx()).domain === 'online' },
  { id: 'online-schedule-kind', category: 'online', run: () => planTurn('איזה משחקים יש מחר', ctx()).onlineKind === 'schedule' },
  { id: 'online-weather', category: 'online', run: () => isOnlineCurrentInfoQuery('מה מזג האוויר בכפר סבא עכשיו') },
  { id: 'online-followup-fragment', category: 'online', run: () => planTurn('של המונדיאל בארצות הברית', ctx({ messages: [{ role: 'user', content: 'מה התוצאות' }, { role: 'assistant', content: 'של איזה משחק?' }] })).domain === 'online' },

  // ── Conversation OS (continuation + repair) ────────────────────────────────
  { id: 'os-continue', category: 'conversation-os', run: () => { let st = recordAnswer(IDLE_CONV, { question: 'q', intent: 'online', fullText: 'בבית א ארגנטינה נגד ירדן. בבית ב צרפת נגד מרוקו. בבית ג ברזיל נגד גרמניה.' }); st = markInterrupted(st, 0); return planTurn('תמשיכי', ctx({ conv: st })).goal === 'continue_previous_answer' } },
  { id: 'os-continue-clean', category: 'conversation-os', run: () => { let st = recordAnswer(IDLE_CONV, { question: 'q', intent: 'online', fullText: 'משפט אחד. משפט שני. משפט שלישי.' }); st = markInterrupted(st, 0); return clean(planTurn('תמשיכי', ctx({ conv: st })).speak) } },
  { id: 'os-why-explains', category: 'conversation-os', run: () => { const st = recordOnline(IDLE_CONV, { query: 'q', topic: null, source: null, ok: false, reason: 'schedule_only', summary: null }); const d = planTurn('למה', ctx({ conv: st })); return d.goal === 'repair_misunderstanding' && !/אין לי אפשרות לבדוק את זה עכשיו/.test(d.speak ?? '') } },
  { id: 'os-why-no-loop', category: 'conversation-os', run: () => { let st = recordOnline(IDLE_CONV, { query: 'q', topic: null, source: null, ok: false, reason: 'provider_failed', summary: null }); const said = new Set<string>(); for (const w of ['למה', 'מה הסיבה', 'אבל יש לך אונליין']) { const d = planTurn(w, ctx({ conv: st })); if (!d.speak || said.has(d.speak)) return false; said.add(d.speak); st = d.conv } return said.size === 3 } },

  // ── Companion tone / no fabricated life / no menu ───────────────────────────
  { id: 'tone-greeting-clean', category: 'companion', run: () => clean(toSpokenText('ערב טוב, Martita. אני פה איתך.')) },
  { id: 'tone-strip-menu', category: 'companion', run: () => clean(toSpokenText('ערב טוב, Martita. אפשר לדבר איתי, לשאול משהו, או לבקש שאקבע לך משהו ביומן.')) },
  { id: 'tone-strip-fake-life', category: 'companion', run: () => !hasFabricatedLife(toSpokenText('היי. קצת עייפה, מור ויעל באו לבקר אתמול. ואת?')) },
  { id: 'tone-strip-fahrenheit', category: 'companion', run: () => !/\d\s*°?\s*F\b/.test(toSpokenText('היום 32°C (90°F) בכפר סבא.')) },
  { id: 'tone-strip-url', category: 'companion', run: () => !/https?:\/\//.test(toSpokenText('התוצאות: ארגנטינה ניצחה. פרטים ב- https://espn.com')) },
  { id: 'tone-grief-warm', category: 'companion', run: () => clean(toSpokenText('כן, פאפי באמת חסר. אני איתך רגע.')) },
  { id: 'tone-max-2-sentences', category: 'companion', run: () => toSpokenText('משפט אחד. משפט שני. משפט שלישי. משפט רביעי.').split(/[.!?]/).filter(x => x.trim().length > 1).length <= 2 },

  // ── Failure copy (localized + offline) ──────────────────────────────────────
  { id: 'fail-spanish', category: 'failure-copy', run: () => !/[֐-׿]/.test(chatTerminalFallback([{ id: '1', role: 'user', content: 'no funciona, dale', timestamp: 0 }] as never, { offline: false })) },
  { id: 'fail-offline-spanish', category: 'failure-copy', run: () => /conexión|internet/i.test(chatTerminalFallback([{ id: '1', role: 'user', content: 'hola qué tal', timestamp: 0 }] as never, { offline: true })) },
  { id: 'fail-hebrew-backcompat', category: 'failure-copy', run: () => chatTerminalFallback([{ id: '1', role: 'user', content: 'זה לא עובד', timestamp: 0 }] as never, { offline: false }) === 'לא הצלחתי עכשיו — תנסי שוב עוד רגע.' },
  { id: 'fail-offline-vs-down', category: 'failure-copy', run: () => chatTerminalFallback([{ id: '1', role: 'user', content: 'מה השעה', timestamp: 0 }] as never, { offline: true }) !== 'לא הצלחתי עכשיו — תנסי שוב עוד רגע.' },

  // ── Routing (family / emotional) ────────────────────────────────────────────
  { id: 'route-family', category: 'routing', run: () => planTurn('מי זאת מור', ctx()).domain === 'family' },
  { id: 'route-emotional', category: 'routing', run: () => planTurn('אני מתגעגעת לפאפי', ctx()).domain === 'emotional' },

  // ── Spanish (Rioplatense) — Martita's second language ───────────────────────
  { id: 'es-cal-intent', category: 'spanish', run: () => isCreateIntent('agendá una reunión con Gabi mañana a las tres') },
  { id: 'es-cal-who', category: 'spanish', run: () => understandMeeting('agendá una reunión con Gabi mañana a las tres').who === 'Gabi' },
  { id: 'es-cal-date-manana', category: 'spanish', run: () => understandMeeting('agendá una reunión con Gabi mañana a las tres').date === '2026-06-25' },
  { id: 'es-cal-time-default-pm', category: 'spanish', run: () => understandMeeting('agendá una reunión con Gabi mañana a las tres').time === '15:00' },
  { id: 'es-cal-time-tarde', category: 'spanish', run: () => understandMeeting('agendá con Gabi mañana a las tres de la tarde').time === '15:00' },
  { id: 'es-cal-time-noche', category: 'spanish', run: () => understandMeeting('agendá con Leo mañana a las ocho de la noche').time === '20:00' },
  { id: 'es-cal-time-manana', category: 'spanish', run: () => understandMeeting('agendá con Gabi mañana a las nueve de la mañana').time === '09:00' },
  { id: 'es-cal-weekday', category: 'spanish', run: () => understandMeeting('quiero una cita con Mor el viernes a las cinco').date === '2026-06-26' },
  { id: 'es-cal-confirm-dale', category: 'spanish', run: () => resolvePendingMessage(startCreate('agendá una reunión con Gabi mañana a las tres'), 'dale', false).action === 'save' },
  { id: 'es-cal-confirm-si', category: 'spanish', run: () => resolvePendingMessage(startCreate('agendá una reunión con Gabi mañana a las tres'), 'sí', false).action === 'save' },
  { id: 'es-online-result', category: 'spanish', run: () => planTurn('quién ganó Argentina contra Jordania', ctx()).domain === 'online' },
  { id: 'es-emotional', category: 'spanish', run: () => planTurn('estoy un poco sola hoy', ctx()).domain === 'emotional' },
]

export interface BenchmarkResult {
  score: number // 0-100
  passed: number
  total: number
  categories: Record<string, { passed: number; total: number }>
  failures: string[]
}

/** Run every scenario and score the pipeline. Used by the war-room cycle. */
export function runBenchmarks(): BenchmarkResult {
  const categories: Record<string, { passed: number; total: number }> = {}
  const failures: string[] = []
  let passed = 0
  for (const s of SCENARIOS) {
    categories[s.category] ??= { passed: 0, total: 0 }
    categories[s.category]!.total++
    let ok = false
    try { ok = s.run() } catch (e) { ok = false; failures.push(`${s.id} (threw: ${(e as Error).message})`) }
    if (ok) { passed++; categories[s.category]!.passed++ }
    else if (!failures.some(f => f.startsWith(s.id))) failures.push(s.id)
  }
  const total = SCENARIOS.length
  return { score: Math.round((passed / total) * 1000) / 10, passed, total, categories, failures }
}

// keep TODAY referenced for clarity of the anchored clock
void TODAY
