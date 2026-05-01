import {
  loadAppointmentsWithFamily,
  FAMILY_BIRTHDAYS,
  FAMILY_MEMORIALS,
  formatHebrewDate,
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

// ─── New tools: exact date, month, past, birthday, memorial ───

export function getEventsByDate(dateStr: string): { events: Appointment[]; summary: string } {
  const year = parseInt(dateStr.slice(0, 4), 10)
  const all = loadAppointmentsWithFamily(year)
  const events = sortByPriority(all.filter(a => a.date === dateStr))
  if (events.length === 0) {
    const label = formatHebrewDate(dateStr)
    return { events, summary: `לא מצאתי כלום ביומן ב${label}.` }
  }
  const label = formatHebrewDate(dateStr)
  if (events.length === 1) {
    const e = events[0]!
    const time = e.time ? ` בשעה ${e.time}` : ''
    return { events, summary: `ב${label} — ${e.title}${time}.` }
  }
  const lines = events.map(e => formatEventNatural(e))
  return { events, summary: `ב${label}:\n${lines.join('\n')}` }
}

export function getEventsByMonth(month: number): { events: Appointment[]; summary: string } {
  const year = new Date().getFullYear()
  const all = loadAppointmentsWithFamily(year)
  const mm = String(month).padStart(2, '0')
  const events = all.filter(a => a.date.slice(5, 7) === mm).sort((a, b) => a.date.localeCompare(b.date))
  if (events.length === 0) {
    const MONTHS = ['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
    return { events, summary: `לא מצאתי כלום ביומן ב${MONTHS[month] ?? ''}.` }
  }
  const lines = events.map(e => {
    const day = parseInt(e.date.slice(8, 10), 10)
    const time = e.time ? ` בשעה ${e.time}` : ''
    return `${e.emoji} ${day} — ${e.title}${time}`
  })
  return { events, summary: lines.join('\n') }
}

export function getBirthdayFor(name: string): { found: boolean; summary: string } {
  const q = name.trim().toLowerCase()
  const match = FAMILY_BIRTHDAYS.find(b =>
    b.personName?.toLowerCase() === q ||
    b.title.toLowerCase().includes(q)
  )
  if (!match) {
    // Also check family data for birthday field
    const family = getFamilyMembers()
    const member = family.find(m =>
      m.hebrew === name || m.canonicalName.toLowerCase() === q || m.aliases.some(a => a.toLowerCase() === q)
    )
    if (member?.birthday) {
      return { found: true, summary: `יום ההולדת של ${member.hebrew} — ${member.birthday}.` }
    }
    return { found: false, summary: `אין לי את תאריך יום ההולדת של ${name}.` }
  }
  const day = parseInt(match.date.slice(8, 10), 10)
  const monthIdx = parseInt(match.date.slice(5, 7), 10) - 1
  const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
  const monthName = MONTHS[monthIdx] ?? ''
  return { found: true, summary: `יום ההולדת של ${match.personName ?? name} — ${day} ב${monthName}.` }
}

export function getMemorialFor(name: string): { found: boolean; summary: string } {
  const q = name.trim().toLowerCase()
  const match = FAMILY_MEMORIALS.find(m =>
    m.personName?.toLowerCase() === q ||
    m.title.toLowerCase().includes(q)
  )
  if (!match) return { found: false, summary: `אין לי מידע על יום הזיכרון של ${name}.` }
  const day = parseInt(match.date.slice(8, 10), 10)
  const monthIdx = parseInt(match.date.slice(5, 7), 10) - 1
  const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
  const monthName = MONTHS[monthIdx] ?? ''
  return { found: true, summary: `יום הזיכרון של ${match.personName ?? name} — ${day} ב${monthName}. 🕯️` }
}

export type ToolName = 'get_today_events' | 'get_tomorrow_events' | 'get_week_events' | 'find_events_by_person' | 'find_next_event_by_type' | 'search_family_info' | 'get_family_context' | 'get_events_by_date' | 'get_birthday_for' | 'get_memorial_for'

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
  {
    type: 'function' as const,
    function: {
      name: 'get_events_by_date',
      description: 'Get all calendar events for a specific date (past or future). Date must be YYYY-MM-DD.',
      parameters: { type: 'object', properties: { date: { type: 'string', description: 'Date in YYYY-MM-DD format' } }, required: ['date'] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_birthday_for',
      description: 'Look up when a family member birthday is',
      parameters: { type: 'object', properties: { name: { type: 'string', description: 'Person name in Hebrew' } }, required: ['name'] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_memorial_for',
      description: 'Look up when a family member memorial day is',
      parameters: { type: 'object', properties: { name: { type: 'string', description: 'Person name in Hebrew' } }, required: ['name'] },
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
      case 'get_events_by_date': return getEventsByDate(args.date ?? '').summary
      case 'get_birthday_for': return getBirthdayFor(args.name ?? '').summary
      case 'get_memorial_for': return getMemorialFor(args.name ?? '').summary
      default: return 'כלי לא מוכר.'
    }
  } catch {
    return 'לא הצלחתי לבדוק את זה כרגע.'
  }
}
