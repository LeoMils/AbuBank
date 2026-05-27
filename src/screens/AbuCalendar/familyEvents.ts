// Family birthdays & memorial, sourced from the canonical knowledge/family_data.json
// (NOT from memory/* which is generation-time only). Replaces the previous
// hard-coded list. A person appears here ONLY if they have a verified `birthday`
// in family_data.json; people without one (e.g. Yael, Yarden, Sharon) are omitted
// — dates are never invented. Privacy: only name + date are mapped; the JSON's
// notes/location/relationship fields are never copied into events.

import type { Appointment } from './service'
import { loadFamilyData } from '../../services/familyLoader'
import familyRaw from '../../../knowledge/family_data.json'

// Local palette (kept independent of service.ts to avoid a circular import).
// Mirrors APPT_COLORS; used only for deterministic, session-stable color choice.
const FAMILY_EVENT_COLORS = [
  '#FF6B9D', '#4ECDC4', '#FFE66D', '#A78BFA',
  '#FB923C', '#34D399', '#60A5FA', '#F472B6',
] as const

const MEMORIAL_COLOR = '#C9A84C' // gold — calm, respectful (design §4.2)

// Preserve the pre-migration event ids for people whose canonical slug changed,
// so already-dismissed alerts (keyed in localStorage by id) do not re-fire once.
const LEGACY_BDAY_ID: Record<string, string> = {
  eili: 'bday-ilai',
  ayalon: 'bday-eylon',
}

const CURRENT_YEAR = new Date().getFullYear()

// Deterministic, session-stable hash → color (never the global cycling colorIndex).
function stableHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
function colorFor(slug: string): string {
  return FAMILY_EVENT_COLORS[stableHash(slug) % FAMILY_EVENT_COLORS.length]!
}

// "Martita" is always shown in Latin script (product rule); everyone else by Hebrew name.
function displayName(canonicalName: string, hebrew: string): string {
  return canonicalName === 'Martita' ? 'Martita' : hebrew
}

export function buildFamilyBirthdays(): Appointment[] {
  return loadFamilyData()
    .filter(m => Boolean(m.birthday))
    .map(m => {
      const slug = m.canonicalName.toLowerCase()
      const name = displayName(m.canonicalName, m.hebrew)
      // A deceased member's birthday is a gentle remembrance (candle), NEVER a
      // celebratory cake — emotional-accuracy rule. Kept here (not a separate
      // memorial) so AbuAI's getBirthdayFor still resolves the month name.
      const deceased = m.relationship === 'husband_deceased'
      return {
        id: deceased ? `bday-${slug}` : (LEGACY_BDAY_ID[slug] ?? `bday-${slug}`),
        title: `יום הולדת ${name} ${deceased ? '🕯️' : '🎂'}`,
        date: `${CURRENT_YEAR}-${m.birthday}`,
        time: '09:00',
        emoji: deceased ? '🕯️' : '🎂',
        color: deceased ? MEMORIAL_COLOR : colorFor(slug),
        type: deceased ? 'memory' : 'birthday',
        personName: name,
        isRecurring: true,
      } satisfies Appointment
    })
}

export function buildFamilyMemorials(): Appointment[] {
  const d = familyRaw.family.deceased
  if (!d?.memorial_date) return []
  const name = d.hebrew_name
  return [{
    id: `memorial-${d.canonical_name.toLowerCase()}`,
    title: `יום הזיכרון של ${name} 🕯️`,
    date: `${CURRENT_YEAR}-${d.memorial_date}`,
    time: '09:00',
    emoji: '🕯️',
    color: MEMORIAL_COLOR,
    type: 'memory',
    personName: name,
    isRecurring: true,
  } satisfies Appointment]
}

// Same names/shapes the calendar + AbuAI already consume, now JSON-backed.
export const FAMILY_BIRTHDAYS: Appointment[] = buildFamilyBirthdays()
export const FAMILY_MEMORIALS: Appointment[] = buildFamilyMemorials()
