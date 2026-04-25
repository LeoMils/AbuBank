import type { RouteType } from './router'
import type { Appointment } from '../AbuCalendar/service'
import type { FamilyMember } from '../../services/familyLoader'

const NOT_FOUND = 'לא מצאתי.'
const TOOL_ERROR = 'אני לא מצליחה לבדוק כרגע.'

export interface CalendarToolResult {
  ok: true
  events: Appointment[]
  summary: string
}

export interface FamilyToolResult {
  ok: true
  found: boolean
  members: FamilyMember[]
  answer: string
}

export interface ToolError {
  ok: false
}

export type ToolResult = CalendarToolResult | FamilyToolResult | ToolError

export function answerFromToolResult(route: RouteType, result: ToolResult): string {
  if (!result.ok) return TOOL_ERROR

  if (route === 'family_lookup') {
    const r = result as FamilyToolResult
    if (!r.found || r.members.length === 0) return NOT_FOUND
    return r.answer
  }

  const r = result as CalendarToolResult
  if (r.events.length === 0) {
    if (route === 'calendar_today') return 'אין לך כלום היום.'
    if (route === 'calendar_tomorrow') return 'אין לך כלום מחר.'
    return 'אין אירועים קרובים.'
  }

  return r.summary
}
