import {
  loadAppointmentsWithFamily,
  type Appointment,
} from '../AbuCalendar/service'
import { classifyMeaning, sortByPriority } from '../AbuCalendar/narration'

export interface FamilyMember {
  canonicalName: string
  hebrew: string
  aliases: string[]
  relationship: string
  relationshipHebrew: string
  spouse?: string
  children?: string[]
  notes?: string
}

const FAMILY: FamilyMember[] = [
  { canonicalName: 'Mor', hebrew: 'מור', aliases: ['מור', 'מורי'], relationship: 'daughter', relationshipHebrew: 'הבת, גרושה מרפי, בת זוג של יעל', children: ['אופיר', 'איילון', 'עילי', 'אדר'], notes: 'גרה עם יעל בוילה בהוד השרון.' },
  { canonicalName: 'Leo', hebrew: 'לאו', aliases: ['לאו', 'לאון', 'ליאו'], relationship: 'son', relationshipHebrew: 'הבן', children: ['עדי', 'נועם'] },
  { canonicalName: 'Raphi', hebrew: 'רפי', aliases: ['רפי', 'Rafi'], relationship: 'ex-son-in-law', relationshipHebrew: 'הגרוש של מור, אבא של הנכדים' },
  { canonicalName: 'Yael', hebrew: 'יעל', aliases: ['יעל'], relationship: 'daughter-partner', relationshipHebrew: 'בת זוג של מור', notes: 'גרה עם מור בוילה בהוד השרון.' },
  { canonicalName: 'Ofir', hebrew: 'אופיר', aliases: ['אופיר'], relationship: 'grandson', relationshipHebrew: 'נכד (בן של מור ורפי)', spouse: 'גלעד', children: ['אנאבל', 'ארי'] },
  { canonicalName: 'Gilad', hebrew: 'גלעד', aliases: ['גלעד'], relationship: 'grandson-in-law', relationshipHebrew: 'בן זוג של אופיר', notes: 'גלעד ואופיר הם ההורים של אנאבל וארי.' },
  { canonicalName: 'Ayalon', hebrew: 'איילון', aliases: ['איילון', 'אילון', 'Eylon'], relationship: 'grandson', relationshipHebrew: 'נכד (בן של מור ורפי)', notes: 'עובר להוד השרון.' },
  { canonicalName: 'Eili', hebrew: 'עילי', aliases: ['עילי', 'עילאי', 'Ilai'], relationship: 'grandson', relationshipHebrew: 'נכד (בן של מור ורפי), נשוי לירדן', notes: 'אין להם ילדים. יש להם 3 כלבים ופנסיון לכלבים בבית.' },
  { canonicalName: 'Yarden', hebrew: 'ירדן', aliases: ['ירדן'], relationship: 'granddaughter-in-law', relationshipHebrew: 'כלה (אשת עילי)', notes: 'גרה עם עילי. יש להם 3 כלבים ופנסיון לכלבים.' },
  { canonicalName: 'Adar', hebrew: 'אדר', aliases: ['אדר'], relationship: 'grandson', relationshipHebrew: 'נכד (הצעיר של מור ורפי)', notes: 'עובר להוד השרון.' },
  { canonicalName: 'Adi', hebrew: 'עדי', aliases: ['עדי'], relationship: 'granddaughter', relationshipHebrew: 'נכדה (בת של לאו)', notes: 'תאומה של נועם. גרה בתל אביב.' },
  { canonicalName: 'Noam', hebrew: 'נועם', aliases: ['נועם'], relationship: 'grandson', relationshipHebrew: 'נכד (בן של לאו)', notes: 'תאום של עדי. גר בהרצליה. נסע לאחרונה לבואנוס איירס.' },
  { canonicalName: 'Anabel', hebrew: 'אנאבל', aliases: ['אנאבל'], relationship: 'great-granddaughter', relationshipHebrew: 'נינה (בת של אופיר וגלעד)' },
  { canonicalName: 'Ari', hebrew: 'ארי', aliases: ['ארי'], relationship: 'great-granddaughter', relationshipHebrew: 'נינה (בת של אופיר וגלעד)' },
  { canonicalName: 'Papi', hebrew: 'פפי', aliases: ['פפי', 'Pepe', 'פאפי'], relationship: 'deceased husband', relationshipHebrew: 'הבעל ז"ל', notes: 'נפטר ב-1 בינואר 2025. נולד 19 באפריל 1941. זוכרים אותו באהבה.' },
  { canonicalName: 'Tonto', hebrew: 'טונטו', aliases: ['טונטו'], relationship: 'pet', relationshipHebrew: 'כלב של עילי וירדן', notes: 'אחד מ-3 הכלבים של עילי וירדן.' },
  { canonicalName: 'Mirta', hebrew: 'מירטה', aliases: ['מירטה'], relationship: 'close friend', relationshipHebrew: 'חברה קרובה' },
  { canonicalName: 'Shoshana', hebrew: 'שושנה', aliases: ['שושנה'], relationship: 'close friend', relationshipHebrew: 'חברה קרובה' },
  { canonicalName: 'Tutsi', hebrew: 'טוטסי', aliases: ['טוטסי', 'טוצי'], relationship: 'pet', relationshipHebrew: 'הכלב של מרטיטה' },
  { canonicalName: 'Sharon', hebrew: 'שרון', aliases: ['שרון'], relationship: 'family friend', relationshipHebrew: 'חברה קרובה של המשפחה' },
]

export function searchFamily(query: string): { found: boolean; members: FamilyMember[]; answer: string } {
  const q = query.trim().toLowerCase()
  if (!q) return { found: false, members: [], answer: 'לא הבנתי את מי את מחפשת.' }

  const exact = FAMILY.filter(m =>
    m.hebrew === q || m.canonicalName.toLowerCase() === q || m.aliases.some(a => a.toLowerCase() === q)
  )
  if (exact.length === 1) {
    const m = exact[0]!
    let answer = `${m.hebrew} — ${m.relationshipHebrew}.`
    if (m.spouse) answer += ` נשוי/אה ל${m.spouse}.`
    if (m.children?.length) answer += ` ילדים: ${m.children.join(', ')}.`
    if (m.notes) answer += ` ${m.notes}`
    return { found: true, members: exact, answer }
  }
  if (exact.length > 1) {
    return { found: true, members: exact, answer: `יש כמה אנשים עם השם הזה: ${exact.map(m => `${m.hebrew} (${m.relationshipHebrew})`).join(', ')}. את מתכוונת למי?` }
  }

  const partial = FAMILY.filter(m =>
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

export function getFamilyContext(): string {
  const kids = FAMILY.filter(m => m.relationship === 'daughter' || m.relationship === 'son')
  const grandkids = FAMILY.filter(m => m.relationship === 'grandson' || m.relationship === 'granddaughter')
  return `ילדים: ${kids.map(m => m.hebrew).join(', ')}. נכדים: ${grandkids.map(m => m.hebrew).join(', ')}.`
}

function todayStr(): string { return new Date().toISOString().split('T')[0]! }
function tomorrowStr(): string { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]! }
function weekEndStr(): string { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]! }

function formatEventList(events: Appointment[]): string {
  if (events.length === 0) return 'אין אירועים.'
  const sorted = sortByPriority(events)
  return sorted.map(e => {
    const time = e.time ? ` ב-${e.time}` : ''
    return `${e.emoji} ${e.title}${time}`
  }).join('\n')
}

export function getTodayEvents(): { events: Appointment[]; summary: string } {
  const all = loadAppointmentsWithFamily(new Date().getFullYear())
  const today = todayStr()
  const events = all.filter(a => a.date === today)
  return { events, summary: events.length === 0 ? 'אין לך כלום היום.' : `היום:\n${formatEventList(events)}` }
}

export function getTomorrowEvents(): { events: Appointment[]; summary: string } {
  const all = loadAppointmentsWithFamily(new Date().getFullYear())
  const tmrw = tomorrowStr()
  const events = all.filter(a => a.date === tmrw)
  return { events, summary: events.length === 0 ? 'אין לך כלום מחר.' : `מחר:\n${formatEventList(events)}` }
}

export function getWeekEvents(): { events: Appointment[]; summary: string } {
  const all = loadAppointmentsWithFamily(new Date().getFullYear())
  const today = todayStr()
  const end = weekEndStr()
  const events = all.filter(a => a.date >= today && a.date <= end)
  if (events.length === 0) return { events, summary: 'אין לך כלום ב-7 הימים הקרובים.' }
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

export function findEventsByPerson(personName: string): { events: Appointment[]; summary: string } {
  const all = loadAppointmentsWithFamily(new Date().getFullYear())
  const today = todayStr()
  const q = personName.trim().toLowerCase()
  const events = all.filter(a =>
    a.date >= today &&
    ((a.personName?.toLowerCase().includes(q)) || a.title.toLowerCase().includes(q) || (a.notes?.toLowerCase().includes(q)))
  )
  if (events.length === 0) return { events, summary: `לא מצאתי אירועים עם ${personName}.` }
  return { events, summary: `אירועים עם ${personName}:\n${formatEventList(events)}` }
}

export function findNextEventByType(type: string): { event: Appointment | null; summary: string } {
  const all = loadAppointmentsWithFamily(new Date().getFullYear())
  const today = todayStr()
  const future = all.filter(a => a.date >= today)
  const sorted = sortByPriority(future)
  const match = sorted.find(a => classifyMeaning(a) === type)
  if (!match) return { event: null, summary: `לא מצאתי ${type === 'medical' ? 'תור רופא' : 'אירוע'} קרוב.` }
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
