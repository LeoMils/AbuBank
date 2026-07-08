/*
 * Calendar Mutation Reasoner (Phase 3)
 * ════════════════════════════════════
 * Controller-reasoned logic for the four domains the legacy cascade used to own:
 * reminders, recurring events, delete, modify. The legacy modules (parseReminder,
 * reminderStore, calendarCreate helpers, AbuCalendar/service) are used ONLY as
 * tools here — they return data/side-effects; the RUNTIME produces the final text
 * (composed + verified + finalized upstream). No legacy module emits user text.
 */
import {
  isRecurringIntent, extractRecurringDay, getNextOccurrences, startCreate,
  isDeleteIntent, isModifyIntent, isConfirm, isCancel,
  parseCreateDate, parseHebrewTimeDetailed,
} from './calendarCreate'
import { resolveMeetingTime } from './meetingIntelligence'
import { detectReminderIntent, parseReminder } from '../AbuCalendar/reminders/reminderParser'
import { createReminder, createDefaultAlertPolicy } from '../AbuCalendar/reminders/reminderStore'
import type { ReminderDraft } from '../AbuCalendar/reminders/types'
import { isExitCurrentFlow } from './aiTaskInterpreter'
import {
  loadAppointments, addAppointment, deleteAppointment, updateAppointment,
} from '../AbuCalendar/service'

export type MutationSideEffect =
  | 'saved_reminder' | 'saved_recurring' | 'deleted' | 'updated' | 'save_failed' | null

export interface MutationResult {
  text: string
  sideEffect: MutationSideEffect
  pendingReminder?: ReminderDraft | null // set/cleared; undefined = unchanged
}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

export function isReminderIntent(text: string): boolean {
  return detectReminderIntent(text) === 'reminder'
}

// A reminder title is real only if it isn't empty and isn't a bare pronoun
// ("לי"/"לך"/"לו"/"לה") — "תזכירי לי" alone must never become a reminder titled "לי".
function reminderTitleOk(title?: string | null): boolean {
  const s = (title ?? '').trim()
  return s.length >= 2 && !/^(?:לי|לך|לו|לה|אותי|אותך)$/u.test(s)
}

// ── Reminders (multi-turn: fresh → confirm/time-followup) ──
export function reminderReasoner(text: string, now: Date, pending: ReminderDraft | null): MutationResult {
  const today = isoDay(now)

  if (pending) {
    // AI Task Interpreter: the user can ALWAYS leave a stuck reminder flow — "זאת שאלה,
    // לא תזכורת" / "תצאי רגע מזה" clears the pending reminder instead of trapping them.
    if (isExitCurrentFlow(text)) return { text: 'בסדר, יצאתי מזה. מה רצית לשאול?', sideEffect: null, pendingReminder: null }
    // Waiting for the time.
    if (!pending.dueAt) {
      if (isCancel(text)) return { text: 'בסדר, ביטלתי.', sideEffect: null, pendingReminder: null }
      const reParsed = parseReminder(`תזכירי לי ${text} ${pending.title ?? ''}`, today)
      if (reParsed.dueAt && reParsed.title) return { text: `${reParsed.readbackText}. לשמור?`, sideEffect: null, pendingReminder: reParsed }
      return { text: 'לא תפסתי מתי. תגידי למשל "מחר בערב" או "בעוד שעה".', sideEffect: null }
    }
    // Waiting for confirmation.
    if (isConfirm(text)) {
      // Never save a garbage/pronoun title ("לי") — ask what to remind instead.
      if (!reminderTitleOk(pending.title)) {
        return { text: 'רגע — מה להזכיר לך בדיוק?', sideEffect: null, pendingReminder: null }
      }
      const { saved } = createReminder({
        category: pending.category,
        title: pending.title ?? '',
        dueAt: pending.dueAt,
        displayDateLabel: pending.displayDateLabel ?? '',
        displayTimeLabel: pending.displayTimeLabel ?? '',
        ...(pending.recurrence ? { recurrence: pending.recurrence } : {}),
        alertPolicy: { ...createDefaultAlertPolicy(), ...pending.alertPolicyDraft },
      })
      return saved
        ? { text: `רשמתי. אזכיר לך ${pending.title ?? ''}.`.trim(), sideEffect: 'saved_reminder', pendingReminder: null }
        : { text: 'לא הצלחתי לשמור את התזכורת. נסי שוב.', sideEffect: 'save_failed', pendingReminder: null }
    }
    if (isCancel(text)) return { text: 'בסדר, ביטלתי.', sideEffect: null, pendingReminder: null }
    // Not confirm/cancel — drop pending and re-parse as a fresh reminder.
  }

  const draft = parseReminder(text, today)
  // A bare "תזכירי לי" with NO content at all → ask WHAT to remind (never accept the
  // pronoun "לי" as the title). Narrow to the pure command so a reminder that carries
  // a day/time ("תזכירי לי מחר") keeps its normal multi-turn flow.
  if (/^(?:תזכירי|תזכרי|תזכיר|להזכיר|תזכורת)\s+לי\s*[.,!?]*$/u.test(text.trim())) {
    return { text: 'מה להזכיר לך? אפשר להגיד למשל: "תזכירי לי לשתות מים בשמונה בערב".', sideEffect: null, pendingReminder: null }
  }
  if (draft.dueAt && draft.title && !draft.ambiguity && draft.missingFields.length === 0) {
    return { text: `${draft.readbackText}. לשמור?`, sideEffect: null, pendingReminder: draft }
  }
  if (draft.missingFields.includes('time')) {
    return { text: `הבנתי: ${draft.title ?? text}. מתי להזכיר לך?`, sideEffect: null, pendingReminder: draft }
  }
  return { text: draft.readbackText ? `${draft.readbackText}. לשמור?` : 'לא הצלחתי להבין. מתי להזכיר לך?', sideEffect: null, pendingReminder: draft.dueAt && draft.title ? draft : null }
}

// ── Recurring events ──
export function recurringReasoner(text: string): MutationResult {
  const day = extractRecurringDay(text)
  if (day === null) return { text: 'באיזה יום בשבוע? למשל: "כל יום שלישי בעשר".', sideEffect: null }
  const next = startCreate(text)
  const title = next.draft.title || 'פגישה'
  const time = next.draft.time || '09:00'
  const dates = getNextOccurrences(day, 4)
  const d = next.draft
  for (const date of dates) {
    addAppointment({
      title, date, time, emoji: d.emoji || '📅', type: 'regular',
      ...(d.location ? { location: d.location } : {}),
      ...(d.person ? { personName: d.person } : {}),
    })
  }
  const saved = loadAppointments()
  const persisted = dates.filter(date => saved.some(a => a.title === title && a.date === date && (a.time ?? null) === time)).length
  const timeStr = next.draft.time ? ` בשעה ${next.draft.time}` : ''
  if (persisted === dates.length) return { text: `קבעתי ${title} כל יום ${DAY_NAMES[day]}${timeStr} ל-4 השבועות הקרובים.`, sideEffect: 'saved_recurring' }
  if (persisted > 0) return { text: `קבעתי ${persisted} מתוך ${dates.length} פעמים. ${title} כל יום ${DAY_NAMES[day]}${timeStr}.`, sideEffect: 'saved_recurring' }
  return { text: 'לא הצליח להישמר. ננסה שוב?', sideEffect: 'save_failed' }
}

// ── Delete ──
export function deleteReasoner(text: string): MutationResult {
  const appts = loadAppointments()
  const nameMatch = text.match(/עם\s+(\S+)|אצל\s+(\S+)/u)
  const term = nameMatch?.[1] ?? nameMatch?.[2] ?? ''
  const matches = term ? appts.filter(a => a.title.toLowerCase().includes(term.toLowerCase())) : appts.slice(-1)
  if (matches.length === 0) return { text: 'אין פגישה כזו ביומן.', sideEffect: null }
  if (matches.length === 1) {
    deleteAppointment(matches[0]!.id)
    const t = matches[0]!.time ? ` בשעה ${matches[0]!.time}` : ''
    return { text: `מחקתי את ${matches[0]!.title}${t}.`, sideEffect: 'deleted' }
  }
  const lines = matches.map((m, i) => `${i + 1}. ${m.title} — ${m.date}`)
  return { text: `יש כמה אפשרויות:\n${lines.join('\n')}\nאיזו למחוק?`, sideEffect: null }
}

// ── Modify / update ──
export function modifyReasoner(text: string): MutationResult {
  const appts = loadAppointments()
  if (appts.length === 0) return { text: 'אין כלום ביומן לשנות.', sideEffect: null }
  const nameMatch = text.match(/את\s+(?:ה?(?:פגישה|תור|ביקור)\s+)?(?:עם\s+)?(\S+)/iu)
  const searchName = nameMatch?.[1] ?? ''
  let target = searchName ? appts.find(a => a.title.toLowerCase().includes(searchName.toLowerCase())) : appts[appts.length - 1]
  if (!target) target = appts[appts.length - 1]!
  const newDate = parseCreateDate(text)
  // Natural modify phrasing uses ל ("לשעה תשע", "לתשע"); the time parsers expect ב.
  const HOURS = 'אחת עשרה|שתים עשרה|אחת|שתיים|שתים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר'
  const normTime = text
    .replace(new RegExp(`(?:ל|ב)?שעה\\s+(${HOURS})`, 'gu'), 'ב$1')
    .replace(new RegExp(`(?<![א-ת])ל(${HOURS})(?![א-ת])`, 'gu'), 'ב$1')
  const newTime = parseHebrewTimeDetailed(normTime)?.time ?? resolveMeetingTime(normTime).time
  const updates: { date?: string; time?: string } = {}
  if (newDate) updates.date = newDate
  if (newTime) updates.time = newTime
  if (Object.keys(updates).length === 0) return { text: 'לא הבנתי מה לשנות. תגידי לאיזה יום או שעה להזיז.', sideEffect: null }
  updateAppointment(target.id, updates)
  const timeStr = updates.time ? ` בשעה ${updates.time}` : ''
  const dateStr = updates.date ? ` ל-${updates.date}` : ''
  return { text: `עדכנתי: ${target.title}${dateStr}${timeStr}.`, sideEffect: 'updated' }
}

export { isRecurringIntent, isDeleteIntent, isModifyIntent }
