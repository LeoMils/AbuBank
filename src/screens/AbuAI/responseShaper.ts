import type { FamilyMember } from '../../services/familyLoader'
import type { Appointment } from '../AbuCalendar/service'

export function shapeFamilyAnswer(m: FamilyMember): string {
  const parts: string[] = []
  const rel = m.relationshipHebrew

  // Split compound relationship: "הבת, גרושה מרפי, בת זוג של יעל"
  // into base role + detail clauses
  const clauses = rel.split(',').map(s => s.trim())
  const baseRole = clauses[0] ?? rel
  const details = clauses.slice(1)

  const isFemale = baseRole.includes('הבת') || baseRole.includes('נכדה') || baseRole.includes('בת זוג')
  const pronoun = isFemale ? 'היא' : 'הוא'
  const possessive = isFemale ? 'שלה' : 'שלו'

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

  if (m.spouse) parts.push(`בן/בת הזוג: ${m.spouse}.`)
  if (m.children?.length) {
    const last = m.children[m.children.length - 1]
    const rest = m.children.slice(0, -1)
    const childList = rest.length > 0 ? `${rest.join(', ')} ו${last}` : last!
    parts.push(`הילדים ${possessive} הם ${childList}.`)
  }
  if (m.notes) parts.push(m.notes)

  return parts.join(' ')
}

export function shapeLocationAnswer(name: string, location: string, notes?: string): string {
  let answer = `${name} גרה ב${location}.`
  if (notes) answer += ` ${notes}.`
  return answer
}

export function shapeCalendarAnswer(events: Appointment[], scope: 'today' | 'tomorrow' | 'week' | 'upcoming'): string {
  if (events.length === 0) {
    const scopeLabel = scope === 'today' ? 'להיום'
      : scope === 'tomorrow' ? 'למחר'
      : scope === 'week' ? 'לשבוע הקרוב'
      : 'קרוב'
    return `לא מצאתי משהו ביומן ${scopeLabel}.`
  }

  const scopePrefix = scope === 'today' ? 'היום'
    : scope === 'tomorrow' ? 'מחר'
    : ''

  if (events.length === 1) {
    const e = events[0]!
    const time = e.time ? ` בשעה ${e.time}` : ''
    return `${scopePrefix} יש לך ${e.title}${time}.`
  }

  const lines = events.slice(0, 4).map(e => {
    const time = e.time ? ` בשעה ${e.time}` : ''
    return `${e.emoji} ${e.title}${time}`
  })

  let answer = `${scopePrefix} יש לך ${events.length} דברים:\n${lines.join('\n')}`
  if (events.length > 4) answer += `\nועוד ${events.length - 4}.`
  return answer.trim()
}

const HOUR_WORDS: Record<number, string> = {
  1: 'אחת', 2: 'שתיים', 3: 'שלוש', 4: 'ארבע', 5: 'חמש', 6: 'שש',
  7: 'שבע', 8: 'שמונה', 9: 'תשע', 10: 'עשר', 11: 'אחת עשרה', 12: 'שתים עשרה',
}

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

function hourWord(h: number): string {
  const h12 = ((h + 11) % 12) + 1
  return HOUR_WORDS[h12] ?? String(h12)
}

const UNIT_WORDS: Record<number, string> = {
  1: 'אחת', 2: 'שתיים', 3: 'שלוש', 4: 'ארבע', 5: 'חמש',
  6: 'שש', 7: 'שבע', 8: 'שמונה', 9: 'תשע',
}

const TENS_WORDS: Record<number, string> = {
  10: 'עשר', 20: 'עשרים', 30: 'שלושים', 40: 'ארבעים', 50: 'חמישים',
}

function minutesToHebrew(m: number): string {
  if (m < 10) return UNIT_WORDS[m] ?? String(m)
  if (m === 10) return 'עשר'
  if (m % 10 === 0) return TENS_WORDS[m] ?? String(m)
  const tens = Math.floor(m / 10) * 10
  const units = m % 10
  return `${TENS_WORDS[tens] ?? tens} ו${UNIT_WORDS[units] ?? units}`
}

function timeToHebrew(time: string): string {
  const [hStr, mStr] = time.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  if (Number.isNaN(h) || Number.isNaN(m)) return ''
  const hw = hourWord(h)
  if (m === 0) return `ב${hw}`
  if (m === 15) return `ב${hw} ורבע`
  if (m === 30) return `ב${hw} וחצי`
  if (m === 45) return `ברבע ל${hourWord(h + 1)}`
  return `ב${hw} ${minutesToHebrew(m)}`
}

function dateToHebrew(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'היום'
  if (diff === 1) return 'מחר'
  return `ביום ${DAY_NAMES[d.getDay()] ?? ''}`
}

function eventPhrase(title: string): string {
  const t = title.trim()
  if (/^(אצל|עם|ב[א-ת])/.test(t)) return `את ${t}`
  return `יש לך ${t}`
}

export function shapeCreateConfirm(input: {
  title: string
  date: string | null
  time: string | null
  location?: string | null
  notes?: string | null
}): string {
  const dateWord = input.date ? dateToHebrew(input.date) : ''
  const timeWord = input.time ? timeToHebrew(input.time) : ''
  const when = [dateWord, timeWord].filter(Boolean).join(' ')
  const event = eventPhrase(input.title)
  const header = when ? `${when} —` : ''
  const lines: string[] = []
  if (header) lines.push(header)
  lines.push(`${event}.`)
  if (input.location) lines.push(`ב${input.location}.`)
  if (input.notes) lines.push(`רשמתי גם: ${input.notes}.`)
  return `${lines.join('\n')}\n\nלקבוע?`.trim()
}

export function shapeNotFound(context?: string): string {
  if (context) return `לא מצאתי מידע על ${context}.`
  return 'לא מצאתי מידע על זה.'
}

export function shapeToolError(): string {
  return 'אני לא מצליחה לבדוק את זה כרגע. נסי שוב.'
}
