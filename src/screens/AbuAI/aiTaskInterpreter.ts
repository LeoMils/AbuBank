/*
 * AI Task Interpreter
 * ═══════════════════
 * Decides WHAT the user actually means before Calendar / Reminder / Online / Family /
 * Memory can run — by inferring the task from sentence structure + context, never from a
 * single keyword. Calendar slots are extracted by the ONE calendar builder (buildEventV2);
 * location and notes are first-class fields. Deterministic, pure, no module-global state.
 */
import { buildEventV2 } from './calendarEventBuilderV2'

export type TaskType =
  | 'calendar_create' | 'calendar_search' | 'calendar_read' | 'calendar_update' | 'calendar_delete'
  | 'reminder_create' | 'online_live' | 'family_relation' | 'family_info' | 'app_help'
  | 'general_conversation' | 'exit_current_flow' | 'follow_up' | 'unknown'

export interface CalendarSlots {
  action: 'create' | 'search' | 'read' | 'update' | 'delete' | null
  title: string | null
  who: string | null
  when: string | null
  date: string | null
  time: string | null
  location: string | null
  notes: string | null
  duration: string | null
  sourceSentence: string
  confidenceByField: Record<string, number>
}

export interface TaskContext { pendingReminder?: boolean; pendingCreate?: boolean; lastMeetingTitle?: string | null; lastAnswerWasMeeting?: boolean }

export interface TaskInterpretation {
  taskType: TaskType
  confidence: number
  reason: string
  normalizedUserMeaning: string
  slots: CalendarSlots | null
  missingRequiredFields: string[]
  followUpTarget: string | null
  shouldAskClarification: boolean
  forbiddenRoutes: TaskType[]
}

// ── inference cues (structure, not lone keywords) ──
const EXIT_RE = /(?:תצאי\s+רגע\s+מזה|תצאי\s+מ?זה|זה\s+לא\s+(?:להזכיר|תזכורת)|ז(?:את|ו)\s+שאלה|לא\s+(?:רוצה\s+)?תזכורת|עזבי\s+את\s+זה|די\s+עם\s+ה?תזכורת|לא\s+התכוונתי\s+ל?תזכורת|רוצה\s+לשאול\s+משהו\s+אחר|תעני\s+לי)/u
const REMIND_RE = /(?:תזכירי\s+לי|תזכורת|הזכירי\s+לי)/u
const CREATE_RE = /(?:תקבעי|קבעי\s+לי|קבע\s+לי|תזמני|רשמי\s+לי\s+פגישה|נקבע)/u
const SEARCH_RE = /(?:יש\s+לי\s+פגישה\s+עם|מתי\s+(?:יש\s+לי|ה)?פגישה|מתי\s+התור|באיזה\s+יום\s+.*(?:פגישה|שלי|תור)|מתי\s+אני\s+(?:נפגש|רואה))/u
const READ_RE = /(?:מה\s+יש\s+לי\s+(?:היום|מחר|השבוע|ב)|מה\s+ביומן|מה\s+התוכניות)/u
const DELETE_RE = /(?:תבטלי|בטלי|תמחקי|מחקי)\s+(?:את\s+)?(?:הפגישה|התור|האירוע)/u
const UPDATE_RE = /(?:תעדכני|עדכני|תשני|שני)\s+(?:את\s+)?(?:הפגישה|התור|השעה|היום)/u
const ONLINE_RE = /(?:איזה\s+משחקים|מי\s+ניצח|מי\s+מנצח|תוצא|מונדיאל|ליגה|איזה\s+סרטים|קולנוע|איזה\s+אוטובוס|רכבת|מזג\s+ה?אוויר|מה\s+חדש|מה\s+קרה\s+היום|הרצא(?:ה|ות)|מופע)/u
const FAMILY_REL_RE = /(?:מה\s+\S+\s+עבור\s+\S+|מה\s+הקשר\s+בין|איך\s+\S+\s+קשור)/u
const FAMILY_INFO_RE = /(?:מי\s+ז(?:ה|את|ו)\s+\S+|בת\s+כמה\s+\S+)/u
const HELP_RE = /(?:איך\s+(?:אני\s+)?(?:מגבה|מגבים|לגבות|משתמש)|איך\s+אני\s+.*הגדרות|מה\s+זה\s+הכפתור)/u
const FOLLOWUP_RE = /^(?:באיזה\s+שעה|ב?איזו\s+שעה|ומתי|ואיפה|ומה\s+עם|באיזה\s+יום)\??$/u
const BIRTHDAY_RE = /(?:יום\s+הולדת|מתי\s+נולד|בן\s+כמה|בת\s+כמה)/u

const emptySlots = (src: string): CalendarSlots => ({ action: null, title: null, who: null, when: null, date: null, time: null, location: null, notes: null, duration: null, sourceSentence: src, confidenceByField: {} })

function calendarSlots(text: string, action: CalendarSlots['action']): CalendarSlots {
  const ev = buildEventV2(text)   // the ONE calendar builder — location/notes first-class
  return {
    action,
    title: ev.title ?? null,
    who: ev.who ?? (ev.attendees?.[0] ?? null),
    when: [ev.date, ev.time].filter(Boolean).join(' ') || null,
    date: ev.date ?? null,
    time: ev.time ?? null,
    location: ev.location ?? null,
    notes: ev.notes ?? null,
    duration: ev.durationLabel ?? (ev.durationMinutes ? `${ev.durationMinutes} דק'` : null),
    sourceSentence: text,
    confidenceByField: {
      title: ev.title ? 0.9 : 0, who: ev.who || ev.attendees?.length ? 0.9 : 0,
      date: ev.date ? 0.9 : 0, time: ev.time ? 0.9 : 0, location: ev.location ? 0.9 : 0,
    },
  }
}

export function isExitCurrentFlow(text: string): boolean { return EXIT_RE.test(text.trim()) }

export function interpretTask(text: string, ctx: TaskContext = {}): TaskInterpretation {
  const t = text.trim()
  const base = (taskType: TaskType, confidence: number, reason: string, extra: Partial<TaskInterpretation> = {}): TaskInterpretation => ({
    taskType, confidence, reason, normalizedUserMeaning: t, slots: null, missingRequiredFields: [],
    followUpTarget: null, shouldAskClarification: false, forbiddenRoutes: [], ...extra,
  })

  // 0) EXIT any pending flow — highest priority, beats a stuck reminder/calendar loop.
  if ((ctx.pendingReminder || ctx.pendingCreate) && isExitCurrentFlow(t))
    return base('exit_current_flow', 0.95, 'user asked to leave the current flow', { forbiddenRoutes: ['reminder_create', 'calendar_create'] })

  // 1) Short follow-up on the last meeting ("באיזה שעה") — never a greeting / new intent.
  if (ctx.lastAnswerWasMeeting && FOLLOWUP_RE.test(t))
    return base('follow_up', 0.9, 'short follow-up on the last meeting', { followUpTarget: ctx.lastMeetingTitle ?? 'last_meeting', forbiddenRoutes: ['calendar_create', 'reminder_create'] })

  // 2) Online live — sports/movies/transport/weather/news; NEVER a reminder.
  if (ONLINE_RE.test(t) && !REMIND_RE.test(t))
    return base('online_live', 0.9, 'live/current-info question', { forbiddenRoutes: ['reminder_create', 'calendar_create'] })

  // 3) Explicit reminder ("תזכירי לי") — a question about the future is NOT a reminder.
  if (REMIND_RE.test(t) && !ONLINE_RE.test(t) && !SEARCH_RE.test(t))
    return base('reminder_create', 0.85, 'explicit reminder request')

  // 4) Calendar — search/read/delete/update BEFORE create ("יש לי פגישה עם X" = search).
  if (DELETE_RE.test(t)) return base('calendar_delete', 0.9, 'delete a calendar event', { slots: calendarSlots(t, 'delete') })
  if (UPDATE_RE.test(t)) return base('calendar_update', 0.9, 'update a calendar event', { slots: calendarSlots(t, 'update') })
  if (SEARCH_RE.test(t)) return base('calendar_search', 0.9, 'search whether/when a meeting exists', { slots: calendarSlots(t, 'search'), forbiddenRoutes: ['calendar_create', 'family_info'] })
  if (READ_RE.test(t)) return base('calendar_read', 0.85, 'read the calendar for a day', { slots: calendarSlots(t, 'read') })
  if (CREATE_RE.test(t)) {
    const slots = calendarSlots(t, 'create')
    const missing = slots.time ? [] : ['time']
    return base('calendar_create', 0.9, 'create a calendar event', { slots, missingRequiredFields: missing, forbiddenRoutes: ['reminder_create'] })
  }

  // 5) Family (relation before info); birthdays are their own thing, not a meeting.
  if (FAMILY_REL_RE.test(t)) return base('family_relation', 0.85, 'family relation question')
  if (BIRTHDAY_RE.test(t)) return base('family_info', 0.8, 'birthday/age question', { forbiddenRoutes: ['calendar_search'] })
  if (FAMILY_INFO_RE.test(t)) return base('family_info', 0.8, 'who-is / family info')

  // 6) App help — answered, never dismissed.
  if (HELP_RE.test(t)) return base('app_help', 0.85, 'app/how-to question')

  // 7) Nothing matched — natural clarification, never a forced menu.
  if (t.length < 3) return base('unknown', 0.3, 'too short to infer', { shouldAskClarification: true })
  return base('general_conversation', 0.5, 'general conversation')
}
