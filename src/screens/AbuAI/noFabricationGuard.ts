/*
 * NO-FABRICATION GUARD (intake-rebuild P6).
 * ════════════════════════════════════════════════════════════════════════════
 * Calendar / appointment facts are DETERMINISTIC (the store), never the LLM. If an
 * LLM-sourced answer nonetheless asserts an appointment at a specific date/time
 * ("יש לך פגישה ב-1 באוקטובר בשלוש") — the "1 באוקטובר" hallucination class — this
 * pre-emission check neutralizes it to an honest deferral to the real calendar,
 * rather than letting a fabricated appointment reach Martita.
 *
 * PRECISE by design: it fires ONLY on an APPOINTMENT FRAME (יש לך/קבעתי/התור/הפגישה
 * + a date or clock), so ordinary prose and historical dates ("המהפכה ב-1789") pass
 * untouched. Pure + deterministic.
 */

// An appointment/scheduling frame — the claim is about Martita's calendar.
const APPT_FRAME = /(?:יש\s+לך|קבעתי|קבענו|רשמתי|נקבע(?:ה|ו)?|התור|ה?פגישה|ה?מפגש|ה?ביקור)\s/u
// A concrete date/time token that would make the frame a specific (fabricable) claim.
const DATE_TIME = /(?:ב-?\s*\d{1,2}\s*ב?(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)|בשעה\s*\d|ב-?\s*\d{1,2}:\d{2}|ביום\s+(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|(?<![א-ת])מחר(?![א-ת])|(?<![א-ת])היום(?![א-ת])|(?<![א-ת])מחרתיים(?![א-ת]))/u

const HONEST_DEFER = 'בואי נבדוק ביומן ביחד מה קבוע — אני לא רוצה להגיד לך תאריך או שעה שאני לא בטוחה בהם.'

/**
 * If an LLM/fallback-sourced answer asserts a specific appointment, replace it with
 * an honest deferral to the real calendar. Deterministic-sourced answers (the calendar
 * engine itself) are trusted and never touched.
 */
export function guardNoFabricatedCalendar(
  text: string,
  source: 'deterministic' | 'llm' | 'online' | 'fallback',
): { text: string; scrubbed: boolean } {
  if (source === 'deterministic' || source === 'online') return { text, scrubbed: false }
  if (APPT_FRAME.test(text) && DATE_TIME.test(text)) return { text: HONEST_DEFER, scrubbed: true }
  return { text, scrubbed: false }
}
