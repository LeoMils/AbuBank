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

export function shapeNotFound(context?: string): string {
  if (context) return `לא מצאתי מידע על ${context}.`
  return 'לא מצאתי מידע על זה.'
}

export function shapeToolError(): string {
  return 'אני לא מצליחה לבדוק את זה כרגע. נסי שוב.'
}
