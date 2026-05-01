import type { FamilyMember } from '../../services/familyLoader'
import type { Appointment } from '../AbuCalendar/service'

// ─── Hebrew number words ────────────────────────────────────────────────────

const HOUR_WORDS: Record<number, string> = {
  1: 'אחת', 2: 'שתיים', 3: 'שלוש', 4: 'ארבע', 5: 'חמש',
  6: 'שש', 7: 'שבע', 8: 'שמונה', 9: 'תשע', 10: 'עשר',
  11: 'אחת עשרה', 12: 'שתים עשרה',
}

const COUNT_WORDS: Record<number, string> = {
  2: 'שני', 3: 'שלושה', 4: 'ארבעה',
}

// ─── Time in spoken Hebrew words ────────────────────────────────────────────

export function timeInWords(time: string): string {
  const [h, min] = time.split(':').map(Number)
  if (h === undefined) return `בשעה ${time}`
  const half = min === 30 ? ' וחצי' : ''

  // Odd minutes (not :00 or :30) — use digits
  if (min !== 0 && min !== 30) return `בשעה ${time}`

  if (h === 0) return 'בחצות'
  if (h === 12) return `בצהריים${half}`

  // Convert 24h → spoken hour + period
  const displayH = h > 12 ? h - 12 : h
  const word = HOUR_WORDS[displayH] ?? `${displayH}`

  if (h < 5) return `ב${word}${half} בלילה`
  if (h < 12) return `ב${word}${half} בבוקר`
  if (h < 17) return `ב${word}${half} אחר הצהריים`
  if (h < 21) return `ב${word}${half} בערב`
  return `ב${word}${half} בלילה`
}

// ─── Family ─────────────────────────────────────────────────────────────────

export function shapeFamilyAnswer(m: FamilyMember): string {
  const parts: string[] = []
  const rel = m.relationshipHebrew

  const clauses = rel.split(',').map(s => s.trim())
  const baseRole = clauses[0] ?? rel
  const details = clauses.slice(1)

  const isFemale = baseRole.includes('הבת') || baseRole.includes('נכדה') || baseRole.includes('בת זוג')
  const possessive = isFemale ? 'שלה' : 'שלו'
  const pronoun = isFemale ? 'היא' : 'הוא'

  if (baseRole.includes('הבת') || baseRole.includes('הבן')) {
    parts.push(`${m.hebrew} ${pronoun} ${baseRole} שלך.`)
    if (details.length > 0) {
      parts.push(`${pronoun} ${details.join(', ')}.`)
    }
  } else if (baseRole.includes('נכד') || baseRole.includes('נכדה')) {
    parts.push(`${m.hebrew} — ${rel}.`)
  } else {
    parts.push(`${m.hebrew} — ${rel}.`)
  }

  if (m.spouse) {
    const spouseRole = isFemale ? 'בן הזוג' : 'בת הזוג'
    parts.push(`${spouseRole} ${possessive} — ${m.spouse}.`)
  }
  if (m.children?.length) {
    const last = m.children[m.children.length - 1]
    const rest = m.children.slice(0, -1)
    const childList = rest.length > 0 ? `${rest.join(', ')} ו${last}` : last!
    parts.push(`הילדים ${possessive} — ${childList}.`)
  }
  if (m.notes) parts.push(m.notes)

  return parts.join('\n')
}

// ─── Location ───────────────────────────────────────────────────────────────

export function shapeLocationAnswer(name: string, location: string, notes?: string): string {
  if (notes) return `${name} גרה ב${location}, ${notes}.`
  return `${name} גרה ב${location}.`
}

// ─── Calendar Read ──────────────────────────────────────────────────────────

export function shapeCalendarAnswer(events: Appointment[], scope: 'today' | 'tomorrow' | 'week' | 'upcoming'): string {
  const scopeWord = scope === 'today' ? 'היום'
    : scope === 'tomorrow' ? 'מחר'
    : ''

  // Empty
  if (events.length === 0) {
    if (scope === 'week') return 'לא מצאתי משהו ביומן לשבוע הזה.'
    return `לא מצאתי משהו ביומן ל${scopeWord === 'היום' ? 'היום' : scopeWord === 'מחר' ? 'מחר' : 'תקופה הזו'}.`
  }

  // Single event
  if (events.length === 1) {
    const e = events[0]!
    const time = e.time ? `\n${timeInWords(e.time)}.` : ''
    if (e.type === 'birthday') {
      return `${scopeWord} ${e.title}.`
    }
    return `${scopeWord} יש לך ${e.title}.${time}`
  }

  // Multiple events — time — title format
  const countWord = COUNT_WORDS[events.length] ?? `${events.length}`
  const lines = events.slice(0, 4).map(e => {
    const time = e.time ? `${timeInWords(e.time)} — ` : ''
    return `${time}${e.title}.`
  })

  let answer = `${scopeWord} יש לך ${countWord} דברים:\n${lines.join('\n')}`
  if (events.length > 4) answer += `\nועוד ${events.length - 4}.`
  return answer.trim()
}

// ─── Calendar Create ────────────────────────────────────────────────────────

import type { CreateDraft } from './calendarCreate'

function dateLabel(date: string): string {
  const today = new Date().toISOString().split('T')[0]!
  const tmrw = new Date(Date.now() + 86400000).toISOString().split('T')[0]!
  if (date === today) return 'היום'
  if (date === tmrw) return 'מחר'
  const d = new Date(date)
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const dayName = days[d.getDay()] ?? ''
  const day = d.getDate()
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
  const monthName = months[d.getMonth()] ?? ''
  return `ביום ${dayName}, ${day} ב${monthName}`
}

function humanTitle(title: string): string {
  if (/^אצל\s/.test(title)) return `להיות ${title}`
  if (/תור\s/.test(title)) return title
  if (/פגישה\s/.test(title)) return title
  if (/ארוחה|ארוחת/.test(title)) return title
  return title
}

export function shapeCreateConfirm(draft: CreateDraft): string {
  const what = draft.title ? humanTitle(draft.title) : 'משהו'
  const when = draft.date ? ` ${dateLabel(draft.date)}` : ''
  const time = draft.time ? ` ${timeInWords(draft.time)}` : ''
  const lines: string[] = [`אני קובעת לך ${what}${when}${time}.`]
  if (draft.location) lines.push(`ב${draft.location}.`)
  if (draft.notes) lines.push(`הערה: ${draft.notes}.`)
  lines.push('זה נכון?')
  return lines.join('\n')
}

// Read-back variant: spoken before voice confirmation. Reads back what / date /
// time / location / reason explicitly, asks "לקבוע?". Missing date/time produce
// a targeted clarification ask (not a normal final confirmation). ambiguousTime
// short-circuits to the AM/PM clarification wording so the read-back never
// silently auto-PMs.
export interface ReadbackDraft {
  title: string | null
  personName?: string | null
  date: string | null
  time: string | null
  location?: string | null
  notes?: string | null
  ambiguousTime?: boolean
}

export function shapeCreateConfirmReadback(draft: ReadbackDraft): string {
  if (draft.ambiguousTime && draft.time) {
    return `לפני שנקבע — ${draft.time} בצהריים או בלילה?`
  }

  const subject = draft.title
    ? humanTitle(draft.title)
    : draft.personName
      ? `פגישה עם ${draft.personName}`
      : 'משהו'

  if (!draft.date) {
    return `הבנתי. לקבוע ${subject}. לא שמעתי תאריך — מתי?`
  }
  if (!draft.time) {
    return `הבנתי. לקבוע ${subject} ${dateLabel(draft.date)}. לא שמעתי שעה — באיזו שעה?`
  }

  let head = `הבנתי. לקבוע ${subject} ${dateLabel(draft.date)} ${timeInWords(draft.time)}`
  if (draft.location) head += ` ב${draft.location}`
  head += '.'
  const parts: string[] = [head]
  if (draft.notes) parts.push(`הסיבה: ${draft.notes}.`)
  parts.push('לקבוע?')
  return parts.join(' ')
}

export function shapeCreateSaved(): string {
  return 'נרשם ביומן.'
}

export function shapeCreateCancelled(): string {
  return 'עזבתי, לא רשמתי.'
}

export function shapeCreateClarify(missing: Array<'title' | 'date' | 'time'>): string {
  const first = missing[0]
  if (first === 'title') return 'מה לרשום?'
  if (first === 'date') return 'באיזה יום?'
  if (first === 'time') return 'באיזו שעה?'
  return 'מה לרשום?'
}

// ─── Fallbacks ──────────────────────────────────────────────────────────────

export function shapeNotFound(context?: string): string {
  if (context) return `לא מצאתי מידע על ${context}.`
  return 'לא מצאתי מידע על זה.'
}

export function shapeToolError(): string {
  return 'אני לא מצליחה לבדוק את זה כרגע. נסי שוב.'
}
