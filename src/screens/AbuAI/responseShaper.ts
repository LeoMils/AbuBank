import type { FamilyMember } from '../../services/familyLoader'
import type { Appointment } from '../AbuCalendar/service'

export function shapeFamilyAnswer(m: FamilyMember): string {
  const parts: string[] = []

  const rel = m.relationshipHebrew
  if (rel.includes('הבת') || rel.includes('הבן')) {
    parts.push(`${m.hebrew} היא ${rel} שלך.`)
  } else if (rel.includes('נכד') || rel.includes('נכדה')) {
    parts.push(`${m.hebrew} — ${rel}.`)
  } else if (rel.includes('בת זוג') || rel.includes('בן זוג')) {
    parts.push(`${m.hebrew} — ${rel}.`)
  } else if (rel.includes('ז"ל')) {
    parts.push(`${m.hebrew} — ${rel}.`)
  } else {
    parts.push(`${m.hebrew} — ${rel}.`)
  }

  if (m.spouse) parts.push(`בן/בת הזוג: ${m.spouse}.`)
  if (m.children?.length) {
    parts.push(`${m.children.length === 1 ? 'ילד' : 'ילדים'}: ${m.children.join(', ')}.`)
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
