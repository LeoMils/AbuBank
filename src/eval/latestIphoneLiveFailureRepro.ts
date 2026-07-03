/*
 * Latest iPhone Live Failure Repro
 * ════════════════════════════════
 * Leo's EXACT latest iPhone failures, as structured assertions on the real
 * extraction + the ExecutiveCognitiveController. Written to FAIL until the root
 * cause is fixed. No synthetic broadening — these are the literal transcripts.
 */
import { understandMeetingSmart, type SmartMeeting } from '../screens/AbuAI/calendarIntelligence'

export const EX1 = 'אני צריך להיפגש מחר עם מוטי כי הוא התקשר אליי ולא נעים לי ממנו, אז אמרתי לו שכן. אני צריך להיפגש איתו מחר בשעה שלוש בקפה מורנו.'
export const EX2 = 'תקבעי לי פגישה מחר בארבע עם אופיר אצלה בבית. גלעד אמר שהוא יגיע בחמש, אבל אולי הוא יכול לאחר קצת.'

export interface ExtractionCheck { id: string; pass: boolean; detail: string }

const tomorrow = (now: Date) => { const d = new Date(now); d.setDate(d.getDate() + 1); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }

export function checkExtraction(now: Date): ExtractionCheck[] {
  const out: ExtractionCheck[] = []
  const add = (id: string, pass: boolean, detail: string) => out.push({ id, pass, detail })
  const tmr = tomorrow(now)

  const m1: SmartMeeting = understandMeetingSmart(EX1)
  const d1 = m1.importantDetails.join(' | ')
  add('ex1-who', m1.who === 'מוטי', `who=${m1.who}`)
  add('ex1-when', m1.date === tmr && m1.time === '15:00', `date=${m1.date} time=${m1.time}`)
  add('ex1-where', !!m1.location && m1.location.includes('קפה מורנו'), `loc=${m1.location}`)
  add('ex1-title', m1.title === 'פגישה עם מוטי', `title=${m1.title}`)
  add('ex1-details-meaningful', /התקשר|נעים|לסרב/.test(d1), `details=[${d1}]`)
  add('ex1-details-no-garbage', !/להגיע\s+ב.*במקום\s+נעים|בהתקשר/.test(d1), `details=[${d1}]`)

  const m2: SmartMeeting = understandMeetingSmart(EX2)
  const d2 = m2.importantDetails.join(' | ')
  add('ex2-who', m2.who === 'אופיר', `who=${m2.who}`)
  add('ex2-when', m2.date === tmr && m2.time === '16:00', `date=${m2.date} time=${m2.time}`)
  add('ex2-where-resolved', !!m2.location && m2.location.includes('אופיר'), `loc=${m2.location}`)
  add('ex2-details-gilad', /גלעד/.test(d2) && /(?:חמש|יאחר|לאחר|יגיע)/.test(d2), `details=[${d2}]`)

  return out
}

export function extractionScore(rows: ExtractionCheck[]): { passed: number; total: number; failures: ExtractionCheck[] } {
  return { passed: rows.filter(r => r.pass).length, total: rows.length, failures: rows.filter(r => !r.pass) }
}
