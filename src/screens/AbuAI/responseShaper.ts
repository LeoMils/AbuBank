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
  const rel = m.relationshipHebrew
  const isFemale = rel.includes('הבת') || rel.includes('נכדה') || rel.includes('בת זוג')

  // Build natural spoken sentence, not a data card
  const parts: string[] = []

  // Role — casual, not "X היא הבת שלך"
  if (rel.includes('הבת')) {
    parts.push(`${m.hebrew}, הבת שלך.`)
  } else if (rel.includes('הבן')) {
    parts.push(`${m.hebrew}, הבן שלך.`)
  } else {
    parts.push(`${m.hebrew} — ${rel}.`)
  }

  // Partner/spouse — natural
  if (m.spouse) {
    parts.push(`עם ${m.spouse}.`)
  }

  // Children — no colon, no list format
  if (m.children?.length) {
    const count = m.children.length
    const last = m.children[count - 1]
    const rest = m.children.slice(0, -1)
    const names = rest.length > 0 ? `${rest.join(', ')} ו${last}` : last!
    if (count <= 2) {
      parts.push(`${isFemale ? 'יש לה' : 'יש לו'} ${count === 1 ? 'ילד אחד' : 'שני ילדים'} — ${names}.`)
    } else {
      parts.push(`${count} ילדים — ${names}.`)
    }
  }

  return parts.join(' ')
}

// ─── Family (Spanish) ────────────────────────────────────────────────────────

export function shapeFamilyAnswerES(m: FamilyMember): string {
  const parts: string[] = []
  const rel = m.relationshipHebrew

  if (rel.includes('הבת')) {
    parts.push(`${m.canonicalName}? Tu hija.`)
  } else if (rel.includes('הבן')) {
    parts.push(`${m.canonicalName}? Tu hijo.`)
  } else if (rel.includes('נכדה')) {
    parts.push(`${m.canonicalName} — tu nieta.`)
  } else if (rel.includes('נכד')) {
    parts.push(`${m.canonicalName} — tu nieto.`)
  } else if (rel.includes('בת זוג')) {
    parts.push(`${m.canonicalName} — la pareja.`)
  } else {
    parts.push(`${m.canonicalName} — ${rel}.`) // fallback to Hebrew rel
  }

  if (m.spouse) {
    parts.push(`Con ${m.spouse}.`)
  }
  if (m.children?.length) {
    const last = m.children[m.children.length - 1]
    const rest = m.children.slice(0, -1)
    const childList = rest.length > 0 ? `${rest.join(', ')} y ${last}` : last!
    parts.push(`Hijos: ${childList}.`)
  }
  if (m.notes) parts.push(m.notes)
  return parts.join('\n')
}

// ─── Location ───────────────────────────────────────────────────────────────

export function shapeLocationAnswerES(name: string, location: string, notes?: string): string {
  if (notes) return `${name} vive en ${location}, ${notes}.`
  return `${name} vive en ${location}.`
}

export function shapeLocationAnswer(name: string, location: string, notes?: string, gender?: 'male' | 'female' | 'unknown'): string {
  const verb = gender === 'male' ? 'גר' : 'גרה'
  if (notes) return `${name} ${verb} ב${location}, ${notes}.`
  return `${name} ${verb} ב${location}.`
}

// ─── Calendar Read ──────────────────────────────────────────────────────────

export function shapeCalendarAnswer(events: Appointment[], scope: 'today' | 'tomorrow' | 'week' | 'upcoming'): string {
  const scopeWord = scope === 'today' ? 'היום'
    : scope === 'tomorrow' ? 'מחר'
    : ''

  // Empty
  if (events.length === 0) {
    if (scope === 'week') return 'שבוע שקט, אין כלום.'
    if (scope === 'today') return 'היום אין כלום. יום חופשי.'
    if (scope === 'tomorrow') return 'מחר אין כלום. יום שקט.'
    return 'אין כלום בתקופה הזו.'
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

// ─── Calendar Read (Spanish) ─────────────────────────────────────────────────

export function shapeCalendarAnswerES(events: Appointment[], scope: 'today' | 'tomorrow' | 'week' | 'upcoming'): string {
  const scopeWord = scope === 'today' ? 'Hoy'
    : scope === 'tomorrow' ? 'Mañana'
    : 'Esta semana'

  if (events.length === 0) {
    return `${scopeWord} no tenés nada en el calendario.`
  }
  if (events.length === 1) {
    const e = events[0]!
    const time = e.time ? ` a las ${e.time}` : ''
    return `${scopeWord} tenés ${e.title}${time}.`
  }
  const lines = events.slice(0, 4).map(e => {
    const time = e.time ? `${e.time} — ` : ''
    return `${time}${e.title}`
  })
  return `${scopeWord} tenés ${events.length} cosas:\n${lines.join('\n')}`
}

// ─── Calendar Create ────────────────────────────────────────────────────────

import type { CreateDraft } from './calendarCreate'

export function dateLabel(date: string): string {
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
  let text = `${what}${when}${time}.`
  if (draft.location) text += ` ב${draft.location}.`
  text += ' נכון?'
  return text
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

export function shapeCreateSaved(draft?: { title?: string | null; date?: string | null; time?: string | null }): string {
  if (draft?.title) {
    return `קבוע.`
  }
  return 'רשום.'
}

export function shapeCreateCancelled(): string {
  return 'בסדר, ביטלתי. תגידי לי מתי שתרצי לקבוע משהו.'
}

// ─── Calendar Create (Spanish) ─────────────────────────────────────────────

function dateLabelES(date: string): string {
  const today = new Date().toISOString().split('T')[0]!
  const tmrw = new Date(Date.now() + 86400000).toISOString().split('T')[0]!
  if (date === today) return 'hoy'
  if (date === tmrw) return 'mañana'
  const d = new Date(date)
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const dayName = days[d.getDay()] ?? ''
  const day = d.getDate()
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const monthName = months[d.getMonth()] ?? ''
  return `el ${dayName} ${day} de ${monthName}`
}

export function shapeCreateConfirmES(draft: CreateDraft): string {
  const what = draft.title ?? 'algo'
  const when = draft.date ? ` ${dateLabelES(draft.date)}` : ''
  const time = draft.time ? ` a las ${draft.time}` : ''
  return `Te agendo ${what}${when}${time}.\n¿Está bien?`
}

export function shapeCreateSavedES(draft?: { title?: string | null; date?: string | null; time?: string | null }): string {
  if (draft?.title) {
    const when = draft.date ? ` ${dateLabelES(draft.date)}` : ''
    const time = draft.time ? ` a las ${draft.time}` : ''
    return `Listo, te agendé ${draft.title}${when}${time}.`
  }
  return 'Listo, quedó agendado.'
}

export function shapeCreateCancelledES(): string {
  return 'Dale, lo cancelé. Decime cuando quieras agendar algo.'
}

export function shapeCreateClarifyES(missing: Array<'title' | 'date' | 'time'>): string {
  const first = missing[0]
  if (first === 'title') return '¿Qué agendo?'
  if (first === 'date') return '¿Qué día?'
  if (first === 'time') return '¿A qué hora?'
  return '¿Qué agendo?'
}

export function shapeCreateUnclear(): string {
  return 'לא הבנתי — את רוצה שאקבע את זה?'
}

export function shapeCreateClarify(
  missing: Array<'title' | 'date' | 'time'>,
  draft?: CreateDraft,
): string {
  const first = missing[0]
  if (first === 'title') return 'מה לרשום?'
  if (first === 'date') return 'באיזה יום?'
  if (first === 'time') {
    // Understood the hour but not AM/PM — ask the specific question instead
    // of a generic "באיזו שעה?".
    if (draft?.ambiguousTime && draft.time) {
      const h = Number(draft.time.split(':')[0])
      const displayH = h > 12 ? h - 12 : h
      const word = HOUR_WORDS[displayH] ?? String(displayH)
      return `באיזו שעה בדיוק — ${word} בבוקר או ${word} בערב?`
    }
    return 'באיזו שעה?'
  }
  return 'מה לרשום?'
}

// ─── Fallbacks ──────────────────────────────────────────────────────────────

// B1 patch: language hint. Defaults to 'he' so every existing call site
// keeps the Hebrew behaviour exactly as before. Future call sites can pass
// 'es' / 'en' / 'mixed' once a language detector is wired through tools.
export type ShaperLang = 'he' | 'es' | 'en' | 'mixed'

export function shapeNotFound(context?: string, lang: ShaperLang = 'he'): string {
  switch (lang) {
    case 'es':
      return 'No sé, Martita.'
    case 'en':
      return context ? `I could not find anything about ${context}.` : 'I could not find anything about that.'
    case 'mixed':
      return context ? `לא יודעת על ${context}.` : 'לא יודעת.'
    case 'he':
    default:
      return context ? `לא יודעת על ${context}.` : 'לא יודעת.'
  }
}

export function shapeToolError(lang: ShaperLang = 'he'): string {
  switch (lang) {
    case 'es':
      return 'Algo se trabó. Probá de nuevo en un ratito.'
    case 'en':
      return 'Something got stuck. Try again in a moment.'
    case 'mixed':
    case 'he':
    default:
      return 'רגע, משהו לא עבד. תנסי עוד פעם.'
  }
}
