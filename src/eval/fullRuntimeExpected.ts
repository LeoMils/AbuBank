/*
 * Independently-computed expected values for the full-runtime replay's date
 * assertions. Kept separate from the runtime so the test checks the runtime
 * against a second computation of the same real date source (not against itself).
 */
import { formatHebrewDate } from '../screens/AbuCalendar/service'

const HE_DAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת']

export function HE_DAYS_EXPECTED(now: Date): string {
  return HE_DAYS[now.getDay()] ?? 'היום'
}

export function hebrewDateExpected(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const iso = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
  try { return formatHebrewDate(iso) } catch { return iso }
}
