import {
  loadAppointmentsWithFamily,
  type Appointment,
} from '../AbuCalendar/service'
import { classifyMeaning, sortByPriority } from '../AbuCalendar/narration'
import { shapeFamilyAnswer, shapeLocationAnswer, shapeCalendarAnswer, shapeNotFound } from './responseShaper'
import { loadFamilyData, type FamilyMember } from '../../services/familyLoader'
export type { FamilyMember }

// Family data loaded from knowledge/family_data.json — single source of truth
function getFamilyMembers(): FamilyMember[] {
  return loadFamilyData()
}

export function searchFamily(query: string): { found: boolean; members: FamilyMember[]; answer: string } {
  const q = query.trim().toLowerCase()
  if (!q) return { found: false, members: [], answer: 'לא הבנתי את מי את מחפשת.' }

  const family = getFamilyMembers()
  const exact = family.filter(m =>
    m.hebrew === q || m.canonicalName.toLowerCase() === q || m.aliases.some(a => a.toLowerCase() === q)
  )
  if (exact.length === 1) {
    return { found: true, members: exact, answer: shapeFamilyAnswer(exact[0]!) }
  }
  if (exact.length > 1) {
    return { found: true, members: exact, answer: `יש כמה אנשים עם השם הזה: ${exact.map(m => `${m.hebrew} (${m.relationshipHebrew})`).join(', ')}. את מתכוונת למי?` }
  }

  const partial = family.filter(m =>
    m.hebrew.includes(q) || m.canonicalName.toLowerCase().includes(q) || m.aliases.some(a => a.toLowerCase().includes(q))
  )
  if (partial.length === 1) {
    const m = partial[0]!
    let answer = `${m.hebrew} — ${m.relationshipHebrew}.`
    if (m.notes) answer += ` ${m.notes}`
    return { found: true, members: partial, answer }
  }
  if (partial.length > 1) {
    return { found: true, members: partial, answer: `מצאתי כמה: ${partial.map(m => m.hebrew).join(', ')}. למי התכוונת?` }
  }

  return { found: false, members: [], answer: `לא מכירה מישהו בשם ${query}. אולי שם אחר?` }
}

export function searchFamilyLocation(query: string): { found: boolean; answer: string } {
  const r = searchFamily(query)
  if (!r.found || r.members.length === 0) return { found: false, answer: shapeNotFound(query) }
  const m = r.members[0]!
  if (!m.location) return { found: true, answer: `אין לי מידע איפה ${m.hebrew} גרה.` }
  return { found: true, answer: shapeLocationAnswer(m.hebrew, m.location, m.locationNotes) }
}

export function getFamilyContext(): string {
  const family = getFamilyMembers()
  const kids = family.filter(m => m.relationship === 'daughter' || m.relationship === 'son')
  const grandkids = family.filter(m => m.relationship === 'grandson' || m.relationship === 'granddaughter')
  return `ילדים: ${kids.map(m => m.hebrew).join(', ')}. נכדים: ${grandkids.map(m => m.hebrew).join(', ')}.`
}

function todayStr(): string { return new Date().toISOString().split('T')[0]! }
function tomorrowStr(): string { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]! }
function weekEndStr(): string { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]! }

function formatEventNatural(e: Appointment): string {
  const time = e.time ? ` בשעה ${e.time}` : ''
  return `${e.emoji} ${e.title}${time}`
}

function formatEventList(events: Appointment[]): string {
  if (events.length === 0) return ''
  const sorted = sortByPriority(events)
  if (sorted.length === 1) return formatEventNatural(sorted[0]!)
  return sorted.map(e => formatEventNatural(e)).join('\n')
}

export function getTodayEvents(): { events: Appointment[]; summary: string } {
  const all = loadAppointmentsWithFamily(new Date().getFullYear())
  const today = todayStr()
  const events = sortByPriority(all.filter(a => a.date === today))
  return { events, summary: shapeCalendarAnswer(events, 'today') }
}

export function getTomorrowEvents(): { events: Appointment[]; summary: string } {
  const all = loadAppointmentsWithFamily(new Date().getFullYear())
  const tmrw = tomorrowStr()
  const events = sortByPriority(all.filter(a => a.date === tmrw))
  return { events, summary: shapeCalendarAnswer(events, 'tomorrow') }
}

export function getWeekEvents(): { events: Appointment[]; summary: string } {
  const all = loadAppointmentsWithFamily(new Date().getFullYear())
  const today = todayStr()
  const end = weekEndStr()
  const events = all.filter(a => a.date >= today && a.date <= end)
  if (events.length === 0) return { events, summary: shapeCalendarAnswer([], 'week') }
  const byDay = new Map<string, Appointment[]>()
  for (const e of events) {
    const day = byDay.get(e.date) ?? []
    day.push(e)
    byDay.set(e.date, day)
  }
  const lines: string[] = []
  for (const [date, dayEvents] of byDay) {
    const d = new Date(date)
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
    lines.push(`יום ${dayNames[d.getDay()] ?? ''} (${date.split('-').reverse().slice(0, 2).join('/')}):`)
    lines.push(formatEventList(dayEvents))
  }
  return { events, summary: lines.join('\n') }
}

export function getUpcomingEvents(limit = 5): { events: Appointment[]; summary: string } {
  const all = loadAppointmentsWithFamily(new Date().getFullYear())
  const today = todayStr()
  const future = all.filter(a => a.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  const events = future.slice(0, limit)
  return { events, summary: shapeCalendarAnswer(events, 'upcoming') }
}

export function findEventsByPerson(personName: string): { events: Appointment[]; summary: string } {
  const all = loadAppointmentsWithFamily(new Date().getFullYear())
  const today = todayStr()
  const q = personName.trim().toLowerCase()
  const events = all.filter(a =>
    a.date >= today &&
    ((a.personName?.toLowerCase().includes(q)) || a.title.toLowerCase().includes(q) || (a.notes?.toLowerCase().includes(q)))
  )
  if (events.length === 0) return { events, summary: `לא מצאתי משהו ביומן עם ${personName}.` }
  return { events, summary: `מה שיש לך עם ${personName}:\n${formatEventList(events)}` }
}

export function findNextEventByType(type: string): { event: Appointment | null; summary: string } {
  const all = loadAppointmentsWithFamily(new Date().getFullYear())
  const today = todayStr()
  const future = all.filter(a => a.date >= today)
  const sorted = sortByPriority(future)
  const match = sorted.find(a => classifyMeaning(a) === type)
  if (!match) return { event: null, summary: `לא מצאתי ${type === 'medical' ? 'תור לרופא' : 'אירוע'} קרוב ביומן.` }
  const time = match.time ? ` ב-${match.time}` : ''
  return { event: match, summary: `${match.emoji} ${match.title} — ${match.date.split('-').reverse().join('/')}${time}` }
}

export type ToolName = 'get_today_events' | 'get_tomorrow_events' | 'get_week_events' | 'find_events_by_person' | 'find_next_event_by_type' | 'search_family_info' | 'get_family_context'

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_today_events',
      description: 'Get all calendar events for today',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_tomorrow_events',
      description: 'Get all calendar events for tomorrow',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_week_events',
      description: 'Get all calendar events for the next 7 days',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'find_events_by_person',
      description: 'Find future calendar events that mention a specific person',
      parameters: { type: 'object', properties: { personName: { type: 'string', description: 'Person name in Hebrew' } }, required: ['personName'] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'find_next_event_by_type',
      description: 'Find the next event of a specific type: medical, social, administrative, optional',
      parameters: { type: 'object', properties: { type: { type: 'string', enum: ['medical', 'social', 'administrative', 'optional'] } }, required: ['type'] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_family_info',
      description: 'Look up information about a family member or friend by name',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'Person name to look up' } }, required: ['query'] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_family_context',
      description: 'Get a brief overview of Martita family structure',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
]

export function executeTool(name: string, args: Record<string, string>): string {
  try {
    switch (name) {
      case 'get_today_events': return getTodayEvents().summary
      case 'get_tomorrow_events': return getTomorrowEvents().summary
      case 'get_week_events': return getWeekEvents().summary
      case 'find_events_by_person': return findEventsByPerson(args.personName ?? '').summary
      case 'find_next_event_by_type': return findNextEventByType(args.type ?? '').summary
      case 'search_family_info': return searchFamily(args.query ?? '').answer
      case 'get_family_context': return getFamilyContext()
      default: return 'כלי לא מוכר.'
    }
  } catch {
    return 'לא הצלחתי לבדוק את זה כרגע.'
  }
}
