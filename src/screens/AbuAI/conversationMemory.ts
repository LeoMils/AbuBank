/*
 * Local Conversation Memory (deterministic)
 * ─────────────────────────────────────────
 * A pure, side-effect-free read over the message history that recovers the
 * three continuity facts AbuAI needs to feel like it remembers Martita:
 *   • lastPerson         — who we were just talking about (pronoun anchor)
 *   • lastTopic          — what the conversation is about right now
 *   • lastCalendarAction — the last thing we DID with the calendar
 *
 * This complements (and feeds) the durable ConversationSummary in service.ts.
 * No LLM, no storage — just discourse reading, so it is fully testable and
 * works offline.
 */
import { findLastMentionedPerson } from './pronounResolver'
import { routePersonalQuery } from './router'
import { isCreateIntent, isDeleteIntent } from './calendarCreate'

export type CalendarActionType = 'create' | 'read' | 'delete' | null

export interface ConversationMemory {
  lastPerson: string | null
  lastTopic: string | null
  lastCalendarAction: CalendarActionType
}

/** Classify a single utterance's calendar action, if any. Delete beats create
 *  beats read so "תבטלי את הפגישה" is never mistaken for a create. */
export function detectCalendarAction(text: string): CalendarActionType {
  const t = (text ?? '').trim()
  if (!t) return null
  // Delete / cancel — user request or assistant confirmation.
  if (isDeleteIntent(t) || /תבטלי|בטלי|תמחקי|מחקי|מחקתי|ביטלתי|ביטול/.test(t)) return 'delete'
  // Create — scheduling intent, or an assistant "קבעתי/רשמתי" confirmation.
  if (isCreateIntent(t) || /קבעתי|רשמתי|הוספתי ליומן/.test(t)) return 'create'
  // Read — any calendar_* read route (today / tomorrow / week / next / person).
  const r = routePersonalQuery(t)
  if (r.type.startsWith('calendar_') && r.type !== 'calendar_create') return 'read'
  return null
}

/** A short topic label for the current thread. Prefers an explicit calendar
 *  context, then the last person, else the last substantive user line. */
function deriveTopic(
  messages: Array<{ role: string; content: string }>,
  lastPerson: string | null,
  lastAction: CalendarActionType,
): string | null {
  if (lastAction) return 'יומן'
  if (lastPerson) return lastPerson
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!
    if (m.role !== 'user') continue
    const t = m.content.trim()
    if (t.split(/\s+/).length >= 2) return t.replace(/[?？!.]+$/u, '').trim()
  }
  return null
}

/**
 * Derive the conversation memory from the full message list. Newest signals win.
 * Deterministic — same input always yields the same memory.
 */
export function deriveConversationMemory(
  messages: Array<{ role: string; content: string }>,
): ConversationMemory {
  const lastPerson = findLastMentionedPerson(messages)

  let lastCalendarAction: CalendarActionType = null
  for (let i = messages.length - 1; i >= 0; i--) {
    const action = detectCalendarAction(messages[i]!.content)
    if (action) { lastCalendarAction = action; break }
  }

  return {
    lastPerson,
    lastTopic: deriveTopic(messages, lastPerson, lastCalendarAction),
    lastCalendarAction,
  }
}
