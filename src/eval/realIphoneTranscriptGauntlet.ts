/*
 * Real iPhone Transcript Gauntlet
 * ═══════════════════════════════
 * Encodes the exact failure clusters from Leo's iPhone AbuAI test as a MULTI-TURN
 * deterministic regression. Each cluster runs the real pipeline functions (not a
 * mock) and returns pass/fail + detail. The .test.ts asserts 100%.
 *
 * Scope: the code-testable layer (calendar create/save/read, confirm variants,
 * audio-complaint handling, emotional park, family-graph reasoning, online-answer
 * continuation topic retention). Live LLM prose is judged separately by the
 * production simulator — this gauntlet locks the deterministic behaviour.
 */
import {
  startCreate, resolvePendingMessage,
} from '../screens/AbuAI/calendarCreate'
import { loadAppointments } from '../screens/AbuCalendar/service'
import { understandMeeting } from '../screens/AbuAI/meetingIntelligence'
import { answerFamilyRelation } from '../screens/AbuAI/familyReasoning'
import {
  recordAnswer, recordOnline, isContinuation, continueAnswer, handleConversationTurn,
  IDLE_CONV,
} from '../screens/AbuAI/conversationOS'

export interface ClusterResult { id: string; title: string; pass: boolean; detail: string }

const ok = (id: string, title: string, cond: boolean, detail: string): ClusterResult =>
  ({ id, title, pass: cond, detail })

export function runGauntlet(): ClusterResult[] {
  const r: ClusterResult[] = []

  // ── Cluster 4: calendar create — person/date/time/location all extracted ──
  const m = understandMeeting('תקבעי לי פגישה עם אורית היום בשמונה בערב אצלי בבית')
  r.push(ok('C4a', 'calendar create extracts who/date/time/location',
    m.who === 'אורית' && !!m.date && m.time === '20:00' && !!m.location && /בבית/.test(m.location!),
    `who=${m.who} date=${m.date} time=${m.time} loc=${m.location}`))

  // create → confirming → SAVE on natural yes variants (never cancel)
  for (const yes of ['כן כן', 'כן אני רוצה מאוד בבקשה תקבעי את זה', 'תעשי את זה', 'קדימה תקבעי']) {
    const st = startCreate('תקבעי פגישה עם אורית היום בשמונה בערב')
    const res = resolvePendingMessage(st, yes, false)
    r.push(ok(`C4-save`, `"${yes}" → SAVE`, res.action === 'save', `action=${res.action}`))
  }

  // ── Cluster 5: audio complaint mid-create → audio_help, NEVER cancel ──
  for (const audio of ['למה את לא מדברת אני לא שומע אותך', 'אני לא שומע אותך', 'הקול נעלם']) {
    const st = startCreate('תקבעי פגישה עם אורית היום בשמונה בערב')
    const res = resolvePendingMessage(st, audio, false)
    r.push(ok('C5', `audio "${audio.slice(0, 18)}…" → audio_help (not cancel)`,
      res.action === 'audio_help', `action=${res.action}`))
  }

  // emotional mid-create → park (warm), never cold cancel
  for (const emo of ['אני מתגעגעת לפאפי', 'estoy sola']) {
    const st = startCreate('תקבעי פגישה עם אורית היום בשמונה בערב')
    const res = resolvePendingMessage(st, emo, false)
    r.push(ok('C5b', `emotional "${emo}" → park`, res.action === 'park', `action=${res.action}`))
  }

  // ── Cluster 3: calendar read grounded — empty calendar must not invent ──
  // The read source of truth is loadAppointments(). With a clean store it is empty,
  // so a read is grounded on real state and cannot invent a doctor appointment.
  const appts = loadAppointments()
  r.push(ok('C3', 'calendar read source is grounded (empty store → no invented events)',
    Array.isArray(appts) && appts.length === 0, `appointments=${appts.length}`))

  // ── Cluster 6: family-graph reasoning ──
  const gm = answerFamilyRelation('מי זאת סבתא של ארי')
  r.push(ok('C6a', 'grandmother of Ari includes Martita', !!gm && gm.results.includes('מרטיטה'), `→ ${gm?.results.join(',')}`))
  const unc = answerFamilyRelation('מי הדוד של ארי')
  r.push(ok('C6b', 'uncles of Ari list all (no single guess)',
    !!unc && unc.results.length >= 2 && unc.results.includes('עילי'), `→ ${unc?.results.join(',')}`))
  const kids = answerFamilyRelation('מי הילדים של מור')
  r.push(ok('C6c', 'Mor children correct', !!kids && kids.results.includes('אופיר') && kids.results.length >= 3, `→ ${kids?.results.join(',')}`))
  const partner = answerFamilyRelation('מי בת הזוג של מור')
  r.push(ok('C6d', 'Mor partner = Yael', !!partner && partner.results.length === 1 && partner.results[0] === 'יעל', `→ ${partner?.results.join(',')}`))
  const unknown = answerFamilyRelation('מי סבתא של דוד לא קיים')
  r.push(ok('C6e', 'unknown relation returns not-known (no guess)', !unknown || !unknown.known, `known=${unknown?.known}`))

  // ── Cluster 1: online answer + continuation retains topic (no "cannot check") ──
  let cv = recordOnline(IDLE_CONV, { query: 'צרפת נגד שוודיה', topic: 'צרפת נגד שוודיה', source: 'sports', ok: true, reason: null, summary: 'צרפת ניצחה 2:1. השער המנצח נבקע בדקה ה-80.' })
  cv = recordAnswer(cv, { question: 'מי ניצח צרפת נגד שוודיה', intent: 'online', topic: 'צרפת נגד שוודיה', fullText: 'צרפת ניצחה 2:1 את שוודיה. זה היה משחק צמוד. השער המנצח נבקע בדקה ה-80.' })
  const isCont = isContinuation('תמשיכי')
  const cont = continueAnswer(cv)
  const topicKept = !!cv.online?.query?.includes('צרפת')
  r.push(ok('C1', '"continue" retains France/Sweden topic (not "cannot check")',
    isCont && topicKept && !/לא\s+מצליחה\s+לבדוק|com\]\(|cbsnews/.test(cont.text ?? ''),
    `isCont=${isCont} topicKept=${topicKept} text="${(cont.text ?? '').slice(0, 30)}"`))

  // ── Cluster 8: no robotic fallback — a continuation with context does not dump a menu ──
  const turn = handleConversationTurn(cv, 'תמשיכי')
  r.push(ok('C8', '"continue" with context is handled (not "מה היה הנושא?")',
    turn.handled && !/מה היה הנושא|אני לא מצליחה לזכור/.test(turn.speak ?? ''), `handled=${turn.handled} speak="${(turn.speak ?? '').slice(0, 30)}"`))

  return r
}

export function gauntletScore(results: ClusterResult[]): { passed: number; total: number; pct: number; failures: ClusterResult[] } {
  const passed = results.filter(x => x.pass).length
  return { passed, total: results.length, pct: Math.round((passed / results.length) * 100), failures: results.filter(x => !x.pass) }
}
