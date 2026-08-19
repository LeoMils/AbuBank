/*
 * Latest iPhone PRODUCT Repro
 * ═══════════════════════════
 * The calendar UI voice-add path uses `parseAppointmentText` (AbuCalendar/service),
 * NOT the AI runtime's `understandMeetingSmart`. On the iPhone this produced a
 * RAW-TRANSCRIPT title and a wrong time (03:00 for "בשעה שלוש"). These checks
 * assert the PRODUCT path now matches the strong extraction. Written to FAIL first.
 */
import { parseAppointmentText } from '../screens/AbuCalendar/service'

export const EX1 = 'אני צריך להיפגש מחר עם מוטי כי הוא התקשר אליי ולא נעים לי ממנו, אז אמרתי לו שכן. אני צריך להיפגש איתו מחר בשעה שלוש בקפה מורנו.'
export const EX2 = 'תקבעי לי פגישה מחר בארבע עם אופיר אצלה בבית. גלעד אמר שהוא יגיע בחמש, אבל אולי הוא יכול לאחר קצת.'

export interface ProductCheck { id: string; pass: boolean; detail: string }

export async function checkProductExtraction(): Promise<ProductCheck[]> {
  const out: ProductCheck[] = []
  const add = (id: string, pass: boolean, detail: string) => out.push({ id, pass, detail })

  const r1 = await parseAppointmentText(EX1)
  add('prod-ex1-title-not-raw', r1.title === 'פגישה עם מוטי', `title=${r1.title}`)
  add('prod-ex1-person', r1.personName === 'מוטי', `person=${r1.personName}`)
  add('prod-ex1-time-pm', r1.time === '15:00', `time=${r1.time}`)
  add('prod-ex1-where', !!r1.location && r1.location.includes('קפה מורנו'), `loc=${r1.location}`)

  const r2 = await parseAppointmentText(EX2)
  add('prod-ex2-title', r2.title === 'פגישה עם אופיר', `title=${r2.title}`)
  add('prod-ex2-time', r2.time === '16:00', `time=${r2.time}`)
  add('prod-ex2-where', !!r2.location && r2.location.includes('אופיר'), `loc=${r2.location}`)
  add('prod-ex2-details-gilad', !!r2.notes && /גלעד/.test(r2.notes), `notes=${r2.notes}`)

  return out
}

export function productScore(rows: ProductCheck[]): { passed: number; total: number; failures: ProductCheck[] } {
  return { passed: rows.filter(r => r.pass).length, total: rows.length, failures: rows.filter(r => !r.pass) }
}
