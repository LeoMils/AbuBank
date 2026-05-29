/*
 * Golden tests for the Hebrew voice calendar pipeline.
 *
 * These are STRICT assertions — they fail loudly on semantic regressions.
 * TODAY_ISO = '2026-05-29' (Friday). TOMORROW_ISO = '2026-05-30' (Saturday).
 *
 * For relative-time tests we assert on dateParse.label (contains 'בעוד X')
 * rather than exact wall-clock times, which are run-time-dependent.
 */

import { describe, it, expect } from 'vitest'
import { runVoicePipelineDiagnostic } from './voicePipelineHarness'

const TODAY_ISO = '2026-05-29'
const TOMORROW_ISO = '2026-05-30'

describe('voice pipeline — 20 golden semantic tests', () => {
  // ── 1 ────────────────────────────────────────────────────────────────
  it('#1 "אני צריכה מחר בבוקר לקחת כדור, תזכירי לי" — reminder, tomorrow, morning', () => {
    const r = runVoicePipelineDiagnostic('אני צריכה מחר בבוקר לקחת כדור, תזכירי לי', TODAY_ISO)
    expect(r.intent).toBe('reminder')
    // Pipeline picks up "מחר" as date label but does not resolve a numeric time
    // from "בבוקר" alone — it sets displayDateLabel='מחר' but leaves dueAt null.
    expect(r.dateParse.label).not.toBeNull()
    expect(r.dateParse.label).toContain('מחר')
    expect(r.finalConfirmationText).toContain('לקחת כדור')
    // Without a fully resolved dueAt, save is blocked.
    expect(r.saveAllowed.allowed).toBe(false)
    expect(r.saveAllowed.reason.length).toBeGreaterThan(0)
  })

  // ── 2 ────────────────────────────────────────────────────────────────
  it('#2 "תזכירי לי עוד חצי שעה לבדוק את הסיר" — reminder, +30 min, הסיר', () => {
    const r = runVoicePipelineDiagnostic('תזכירי לי עוד חצי שעה לבדוק את הסיר', TODAY_ISO)
    expect(r.intent).toBe('reminder')
    expect(r.dateParse.label).not.toBeNull()
    expect(r.dateParse.label).toContain('בעוד 30 דקות')
    // finalConfirmationText must mention the task
    const text = r.finalConfirmationText
    expect(text.includes('לבדוק את הסיר') || text.includes('הסיר')).toBe(true)
    expect(r.saveAllowed.allowed).toBe(true)
  })

  // ── 3 ────────────────────────────────────────────────────────────────
  it('#3 "קבעי לי מחר פגישה עם הבעל של אופיר בשעה תשע בערב" — appointment, tomorrow, 21:00, גלעד resolved', () => {
    const r = runVoicePipelineDiagnostic('קבעי לי מחר פגישה עם הבעל של אופיר בשעה תשע בערב', TODAY_ISO)
    expect(r.intent).toBe('appointment')
    expect(r.dateParse.date).toBe(TOMORROW_ISO)
    expect(r.timeParse.time).toBe('21:00')
    expect(r.relationPhrase).toBe('הבעל של אופיר')
    expect(r.resolvedPerson.name).toBe('גלעד')
    expect(r.saveAllowed.allowed).toBe(true)
  })

  // ── 4 ────────────────────────────────────────────────────────────────
  it('#4 "יש לי תור לרופא ביום ראשון בשתיים בצהריים" — appointment, Sunday 2026-05-31, 14:00', () => {
    const r = runVoicePipelineDiagnostic('יש לי תור לרופא ביום ראשון בשתיים בצהריים', TODAY_ISO)
    expect(r.intent).toBe('appointment')
    // TODAY_ISO 2026-05-29 is Friday; next ראשון (Sunday) is 2026-05-31.
    expect(r.dateParse.date).toBe('2026-05-31')
    expect(r.timeParse.time).toBe('14:00')
    expect(r.saveAllowed.allowed).toBe(true)
  })

  // ── 5 ────────────────────────────────────────────────────────────────
  it('#5 "תוסיפי תור לתופרת ביום ראשון בשתיים בצהריים" — appointment, Sunday 2026-05-31, 14:00', () => {
    const r = runVoicePipelineDiagnostic('תוסיפי תור לתופרת ביום ראשון בשתיים בצהריים', TODAY_ISO)
    expect(r.intent).toBe('appointment')
    expect(r.dateParse.date).toBe('2026-05-31')
    expect(r.timeParse.time).toBe('14:00')
    expect(r.saveAllowed.allowed).toBe(true)
  })

  // ── 6 ────────────────────────────────────────────────────────────────
  it('#6 "מה יש לי השבוע" — schedule_query, save not allowed', () => {
    const r = runVoicePipelineDiagnostic('מה יש לי השבוע', TODAY_ISO)
    expect(r.intent).toBe('schedule_query')
    expect(r.saveAllowed.allowed).toBe(false)
  })

  // ── 7 ────────────────────────────────────────────────────────────────
  it('#7 "מה התוכניות שלי השבוע" — schedule_query, save not allowed', () => {
    const r = runVoicePipelineDiagnostic('מה התוכניות שלי השבוע', TODAY_ISO)
    expect(r.intent).toBe('schedule_query')
    expect(r.saveAllowed.allowed).toBe(false)
  })

  // ── 8 ────────────────────────────────────────────────────────────────
  it('#8 "תזכירי לי בעוד שתי דקות לקחת כדור" — reminder, +2 min label, task in confirmation', () => {
    const r = runVoicePipelineDiagnostic('תזכירי לי בעוד שתי דקות לקחת כדור', TODAY_ISO)
    expect(r.intent).toBe('reminder')
    expect(r.dateParse.label).not.toBeNull()
    expect(r.dateParse.label).toContain('בעוד 2 דקות')
    expect(r.finalConfirmationText).toContain('לקחת כדור')
    expect(r.saveAllowed.allowed).toBe(true)
  })

  // ── 9 ────────────────────────────────────────────────────────────────
  it('#9 "בעוד עשר דקות סליחה בעוד שתי דקות להתקשר למשה" — self-correction normalizes transcript', () => {
    const r = runVoicePipelineDiagnostic('בעוד עשר דקות סליחה בעוד שתי דקות להתקשר למשה', TODAY_ISO)
    expect(r.normalizedTranscript).toBe('בעוד שתי דקות להתקשר למשה')
    expect(r.normalizedTranscript).not.toContain('סליחה')
    expect(r.normalizedTranscript).not.toContain('עשר דקות')
  })

  // ── 10 ───────────────────────────────────────────────────────────────
  it('#10 "תקבעי פגישה עם גלעד מחר בתשע בערב" — appointment, tomorrow, 21:00, גלעד', () => {
    const r = runVoicePipelineDiagnostic('תקבעי פגישה עם גלעד מחר בתשע בערב', TODAY_ISO)
    expect(r.intent).toBe('appointment')
    expect(r.dateParse.date).toBe(TOMORROW_ISO)
    expect(r.timeParse.time).toBe('21:00')
    expect(r.resolvedPerson.name).toBe('גלעד')
    expect(r.saveAllowed.allowed).toBe(true)
  })

  // ── 11 ───────────────────────────────────────────────────────────────
  it('#11 "יש לי פגישה עם הרופא מחר בעשר וחצי בבוקר" — appointment, tomorrow, 10:30', () => {
    const r = runVoicePipelineDiagnostic('יש לי פגישה עם הרופא מחר בעשר וחצי בבוקר', TODAY_ISO)
    expect(r.intent).toBe('appointment')
    expect(r.dateParse.date).toBe(TOMORROW_ISO)
    expect(r.timeParse.time).toBe('10:30')
    expect(r.saveAllowed.allowed).toBe(true)
  })

  // ── 12 ───────────────────────────────────────────────────────────────
  it('#12 "תזכירי לי כל יום בתשע בבוקר לקחת תרופה" — reminder, recurring daily, save allowed', () => {
    const r = runVoicePipelineDiagnostic('תזכירי לי כל יום בתשע בבוקר לקחת תרופה', TODAY_ISO)
    expect(r.intent).toBe('reminder')
    expect(r.saveAllowed.allowed).toBe(true)
  })

  // ── 13 ───────────────────────────────────────────────────────────────
  it('#13 "מה יש לי מחר" — schedule_query, save not allowed', () => {
    const r = runVoicePipelineDiagnostic('מה יש לי מחר', TODAY_ISO)
    expect(r.intent).toBe('schedule_query')
    expect(r.saveAllowed.allowed).toBe(false)
  })

  // ── 14 ───────────────────────────────────────────────────────────────
  it('#14 "תקבעי פגישה עם הבן של מור ביום שני בשמונה בערב" — appointment, 2026-06-01, 20:00, ambiguous person', () => {
    const r = runVoicePipelineDiagnostic('תקבעי פגישה עם הבן של מור ביום שני בשמונה בערב', TODAY_ISO)
    expect(r.intent).toBe('appointment')
    // TODAY_ISO 2026-05-29 is Friday; next שני (Monday) is 2026-06-01.
    expect(r.dateParse.date).toBe('2026-06-01')
    expect(r.timeParse.time).toBe('20:00')
    // מור has 4 male children → ambiguous
    expect(r.resolvedPerson.status).toBe('ambiguous')
    expect(r.saveAllowed.allowed).toBe(false)
  })

  // ── 15 ───────────────────────────────────────────────────────────────
  it('#15 "יש לי תור אצל התופרת מחר בשעה 10:32 ברחוב קוק 14 בהרצליה" — appointment, tomorrow, 10:32', () => {
    const r = runVoicePipelineDiagnostic(
      'יש לי תור אצל התופרת מחר בשעה 10:32 ברחוב קוק 14 בהרצליה',
      TODAY_ISO,
    )
    expect(r.intent).toBe('appointment')
    expect(r.dateParse.date).toBe(TOMORROW_ISO)
    expect(r.timeParse.time).toBe('10:32')
    expect(r.saveAllowed.allowed).toBe(true)
  })

  // ── 16 ───────────────────────────────────────────────────────────────
  it('#16 "תזכירי לי בעוד עשרים דקות להתקשר לרופאה" — reminder, +20 min label, save allowed', () => {
    const r = runVoicePipelineDiagnostic('תזכירי לי בעוד עשרים דקות להתקשר לרופאה', TODAY_ISO)
    expect(r.intent).toBe('reminder')
    expect(r.dateParse.label).not.toBeNull()
    expect(r.dateParse.label).toContain('בעוד 20 דקות')
    expect(r.saveAllowed.allowed).toBe(true)
  })

  // ── 17 ───────────────────────────────────────────────────────────────
  it('#17 "מה קורה לי היום" — schedule_query, save not allowed', () => {
    const r = runVoicePipelineDiagnostic('מה קורה לי היום', TODAY_ISO)
    expect(r.intent).toBe('schedule_query')
    expect(r.saveAllowed.allowed).toBe(false)
  })

  // ── 18 ───────────────────────────────────────────────────────────────
  it('#18 "תזכירי לי לקחת תרופה" — reminder, no date/time → save blocked with reason', () => {
    const r = runVoicePipelineDiagnostic('תזכירי לי לקחת תרופה', TODAY_ISO)
    expect(r.intent).toBe('reminder')
    expect(r.saveAllowed.allowed).toBe(false)
    expect(r.saveAllowed.reason.length).toBeGreaterThan(0)
    // Reason must be non-trivial (not just 'ok')
    expect(r.saveAllowed.reason).not.toBe('ok')
  })

  // ── 19 ───────────────────────────────────────────────────────────────
  it('#19 "יש לי פגישה בשלוש" — appointment, ambiguous time (AM/PM), save blocked', () => {
    const r = runVoicePipelineDiagnostic('יש לי פגישה בשלוש', TODAY_ISO)
    expect(r.intent).toBe('appointment')
    expect(r.timeParse.ambiguous).toBe(true)
    expect(r.saveAllowed.allowed).toBe(false)
  })

  // ── 20 ───────────────────────────────────────────────────────────────
  it('#20 "" (empty string) — unknown intent, save not allowed', () => {
    const r = runVoicePipelineDiagnostic('', TODAY_ISO)
    expect(r.intent).toBe('unknown')
    expect(r.saveAllowed.allowed).toBe(false)
  })
})
