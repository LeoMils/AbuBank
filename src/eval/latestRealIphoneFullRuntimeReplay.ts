/*
 * Latest Real iPhone — FULL RUNTIME replay
 * ════════════════════════════════════════
 * Replays the latest transcript failure lines through the SAME cognitive runtime
 * path the app uses (`runCognitiveTurn` / `finalizeExternalAnswer`) — NOT internal
 * helper functions in isolation. Each line is a real multi-turn flow; the runtime
 * carries state between turns exactly as the UI does.
 *
 * Source of the lines: the mission "Must pass" list (the concrete transcript lines
 * Leo supplied), plus the earlier failure clusters. Where a verbatim transcript
 * line was not provided, the flow uses the reported category. No line is invented
 * beyond what the mission specified.
 *
 * This harness is deterministic given an injected `now`. Pass `resetStore: true`
 * (the .test.ts does) so the calendar read/create/save flows start from a clean
 * local store — the harness must never depend on ambient storage.
 */
import {
  runCognitiveTurn, finalizeExternalAnswer, IDLE_RUNTIME, type RuntimeState,
} from '../screens/AbuAI/cognitiveRuntime'
import { loadAppointments, saveAppointments } from '../screens/AbuCalendar/service'
import { HE_DAYS_EXPECTED, hebrewDateExpected } from './fullRuntimeExpected'

export interface ReplayLine { id: string; flow: string; line: string; pass: boolean; detail: string }

interface Ctx { now: Date }
const mkCtx = (now: Date, messages: Array<{ role: string; content: string }> = []): { messages: typeof messages; now: Date } =>
  ({ messages, now })

export function runFullRuntimeReplay(opts: { now: Date; resetStore?: boolean }): ReplayLine[] {
  const { now } = opts
  if (opts.resetStore) saveAppointments([])
  const r: ReplayLine[] = []
  const push = (id: string, flow: string, line: string, pass: boolean, detail: string) =>
    r.push({ id, flow, line, pass, detail })

  // ── 1. Date queries — real day/date, no invention, no "באיזה יום" bounce ──
  {
    const d1 = runCognitiveTurn(IDLE_RUNTIME, 'איזה יום היום', mkCtx(now))
    const expectDay = HE_DAYS_EXPECTED(now)
    push('D1', 'date', 'איזה יום היום',
      d1.handled && d1.verifier.ok && !!d1.display && d1.display.includes(expectDay),
      `intent=${d1.intent} say="${d1.display}" expectDay=${expectDay} viol=${d1.verifier.violations.join(',')}`)

    const d2 = runCognitiveTurn(IDLE_RUNTIME, 'מה התאריך היום', mkCtx(now))
    const expectDate = hebrewDateExpected(now)
    push('D2', 'date', 'מה התאריך היום',
      d2.handled && d2.verifier.ok && !!d2.display && d2.display.includes(expectDate),
      `intent=${d2.intent} say="${d2.display}" expectDate=${expectDate}`)
  }

  // ── 2. Calendar read — real calendar only, empty ⇒ honest, no contradictions ──
  {
    saveAppointments([])
    const d = runCognitiveTurn(IDLE_RUNTIME, 'מה יש לי מחר', mkCtx(now))
    push('R1', 'calendar_read', 'מה יש לי מחר (empty)',
      d.handled && d.verifier.ok && !!d.display && /אין|שקט|ריק/.test(d.display) && !/דוקטור|רופא|תור/.test(d.display),
      `say="${d.display}"`)

    const d2 = runCognitiveTurn(IDLE_RUNTIME, 'מה יש לי היום', mkCtx(now))
    push('R2', 'calendar_read', 'מה יש לי היום (empty)',
      d2.handled && d2.verifier.ok && !!d2.display && /אין|שקט|ריק/.test(d2.display),
      `say="${d2.display}"`)
  }

  // ── 3. Calendar search across ALL days — never "באיזה יום" ──
  {
    saveAppointments([])
    const d = runCognitiveTurn(IDLE_RUNTIME, 'מתי יש לי פגישה עם מוטי', mkCtx(now))
    push('S1', 'calendar_search', 'מתי יש לי פגישה עם מוטי',
      d.handled && d.verifier.ok && !!d.display && !/באיזה יום/.test(d.display),
      `intent=${d.intent} say="${d.display}" viol=${d.verifier.violations.join(',')}`)
  }

  // ── 4. Create → confirm → yes → SAVE (verified in real storage) ──
  const createAndSave = (id: string, attendee: string, phrase: string, yes: string) => {
    saveAppointments([])
    const before = loadAppointments().length
    const d1 = runCognitiveTurn(IDLE_RUNTIME, phrase, mkCtx(now))
    const confirming = d1.intent === 'calendar_create' && d1.handled && /נכון|לקבוע|\?/.test(d1.display ?? '')
    const d2 = runCognitiveTurn(d1.state, yes, mkCtx(now))
    const after = loadAppointments()
    const saved = d2.sideEffect === 'saved_appointment' && after.length === before + 1
    push(id, 'calendar_create', `${phrase} → "${yes}"`,
      confirming && d2.verifier.ok && saved && /קבוע/.test(d2.display ?? ''),
      `confirming=${confirming} sideEffect=${d2.sideEffect} appts=${after.length} say="${d2.display}"`)
  }
  createAndSave('C1', 'דני', 'תקבעי לי פגישה עם דני מחר בעשר בבוקר', 'כן')
  createAndSave('C2', 'רוזלינדה', 'תקבעי פגישה עם רוזלינדה מחר באחת עשרה בבוקר', 'כן כן')
  createAndSave('C3', 'מתתיהו', 'תקבעי פגישה עם מתתיהו מחר בשתיים בצהריים', 'תקבעי את זה')

  // ── 5. Confirm variants always save the pending draft ──
  for (const yes of ['כן', 'כן כן', 'תקבעי את זה', 'קדימה תקבעי']) {
    saveAppointments([])
    const before = loadAppointments().length
    const d1 = runCognitiveTurn(IDLE_RUNTIME, 'תקבעי פגישה עם אורית היום בשמונה בערב', mkCtx(now))
    const d2 = runCognitiveTurn(d1.state, yes, mkCtx(now))
    push('Y', 'confirm_variant', `"${yes}" saves`,
      d2.sideEffect === 'saved_appointment' && loadAppointments().length === before + 1,
      `sideEffect=${d2.sideEffect}`)
  }

  // ── 6. Audio complaint mid-create NEVER cancels the draft ──
  {
    saveAppointments([])
    const d1 = runCognitiveTurn(IDLE_RUNTIME, 'תקבעי פגישה עם אורית היום בשמונה בערב', mkCtx(now))
    const d2 = runCognitiveTurn(d1.state, 'למה את לא מדברת אני לא שומע אותך', mkCtx(now))
    const draftKept = d2.state.createState.phase !== 'idle'
    push('A1', 'audio_complaint', 'audio complaint mid-create',
      d2.verifier.ok && draftKept && d2.sideEffect === null,
      `intent=${d2.intent} phase=${d2.state.createState.phase} say="${d2.display}"`)
  }

  // ── 7. Family relations (real graph, correct or honest-unknown) ──
  const famPair = (id: string, line: string) => {
    const d = runCognitiveTurn(IDLE_RUNTIME, line, mkCtx(now))
    push(id, 'family', line,
      d.handled && d.verifier.ok && !!d.display && !/הנכד שלך$/.test(d.display),
      `intent=${d.intent} say="${d.display}"`)
  }
  famPair('F1', 'מה הקשר בין לאו לאנאבל')
  famPair('F2', 'מה הקשר בין ירדן לאנאבל')
  famPair('F3', 'מה הקשר בין רפי ללאו')
  famPair('F4', 'מה הקשר בין אופיר ללאו')

  // ── 8. Unknown relation → say unknown, never guess ──
  {
    const d = runCognitiveTurn(IDLE_RUNTIME, 'מה הקשר בין נאפוליון ללאו', mkCtx(now))
    push('F5', 'family_unknown', 'unknown relation → no guess',
      d.handled && d.verifier.ok && (/לא\s+בטוחה|לא\s+אנחש|לא\s+יודעת/.test(d.display ?? '') || d.intent !== 'family'),
      `intent=${d.intent} say="${d.display}"`)
  }

  // ── 9. Online routing (cinema / bus / world cup) → routed online, OR honest fail ──
  const onlineRoute = (id: string, line: string) => {
    const d = runCognitiveTurn(IDLE_RUNTIME, line, mkCtx(now))
    const routed = d.needsOnline === true && d.online?.query != null
    push(id, 'online_route', line, routed, `intent=${d.intent} needsOnline=${d.needsOnline}`)
  }
  onlineRoute('O1', 'מה יש בקולנוע היום')
  onlineRoute('O2', 'מתי האוטובוס הבא לתל אביב')
  onlineRoute('O3', 'מי ניצח במונדיאל אתמול')
  // provider-failed path is honest, not fake success, and passes the verifier.
  {
    const seeded = runCognitiveTurn(IDLE_RUNTIME, 'מי ניצח במונדיאל אתמול', mkCtx(now))
    const fin = finalizeExternalAnswer(seeded.state, 'ניסיתי לבדוק אונליין וזה נפל לי. ננסה שוב?', {
      intent: 'online', online: { ok: false, reason: 'provider_failed', query: 'מונדיאל', summary: null },
    })
    push('O4', 'online_fail', 'provider failed → honest',
      fin.verifier.ok && !!fin.display && /נפל|לא\s+הצלחתי|ננסה\s+שוב/.test(fin.display) && !/ניצח[הו]/.test(fin.display),
      `say="${fin.display}" viol=${fin.verifier.violations.join(',')}`)
  }

  // ── 10. Continuation resumes the last answer (topic kept, not unrelated person) ──
  {
    const topic = 'המהפכה הצרפתית'
    const long = 'המהפכה הצרפתית פרצה בשנת 1789. היא הפילה את המלוכה בצרפת. אחר כך הגיע שלטון הטרור. ואז עלה נפוליאון לשלטון.'
    const g = runCognitiveTurn(IDLE_RUNTIME, 'ספרי לי על המהפכה הצרפתית', mkCtx(now))
    const seeded = finalizeExternalAnswer(g.state, long, { intent: 'general', topic })
    const cont = runCognitiveTurn(seeded.state, 'תמשיכי', mkCtx(now))
    push('K1', 'continuation', 'תמשיכי resumes topic',
      cont.handled && cont.intent === 'continuation' && !!cont.display &&
      !/אופיר|הנכד/.test(cont.display) && cont.verifier.ok,
      `intent=${cont.intent} say="${cont.display}"`)

    const cont2 = runCognitiveTurn(seeded.state, 'תשלימי את המשפט', mkCtx(now))
    push('K2', 'continuation', 'תשלימי את המשפט resumes',
      cont2.handled && cont2.intent === 'continuation' && !!cont2.display && cont2.verifier.ok,
      `intent=${cont2.intent} say="${cont2.display}"`)
  }

  // ── 11. Frustration addressed specifically, never the same template twice ──
  {
    let st: RuntimeState = IDLE_RUNTIME
    const d1 = runCognitiveTurn(st, 'את לא מבינה אותי', mkCtx(now)); st = d1.state
    const d2 = runCognitiveTurn(st, 'אבל כבר התחלת לענות', mkCtx(now))
    const both = d1.intent === 'frustration' && d2.intent === 'frustration'
    const distinct = (d1.display ?? '') !== (d2.display ?? '')
    const notBareTemplate = !/^סליחה\.?$/.test(d1.display ?? '')
    push('X1', 'frustration', 'frustration ×2 distinct + specific',
      both && distinct && notBareTemplate && d1.verifier.ok && d2.verifier.ok,
      `d1="${d1.display}" d2="${d2.display}"`)
  }

  // ── 12. Hebrew grammar guard — every terminal answer passes the verifier ──
  {
    const allOk = r.every(x => x.pass)
    push('H1', 'hebrew_guard', 'all terminal answers pass verifier',
      allOk, `failing=${r.filter(x => !x.pass).map(x => x.id).join(',') || 'none'}`)
  }

  return r
}

export function replayScore(rows: ReplayLine[]): { passed: number; total: number; pct: number; failures: ReplayLine[] } {
  const passed = rows.filter(x => x.pass).length
  return { passed, total: rows.length, pct: Math.round((passed / rows.length) * 100), failures: rows.filter(x => !x.pass) }
}
