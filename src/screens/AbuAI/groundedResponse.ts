import type { RouteType } from './router'
import type { Appointment } from '../AbuCalendar/service'
import type { FamilyMember } from '../../services/familyLoader'

const NOT_FOUND = 'לא מצאתי מידע על זה.'
const TOOL_ERROR = 'אני לא מצליחה לבדוק את זה כרגע. נסי שוב.'

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
    if (route === 'calendar_today') return 'לא מצאתי משהו ביומן להיום.'
    if (route === 'calendar_tomorrow') return 'לא מצאתי משהו ביומן למחר.'
    return 'לא מצאתי אירועים קרובים ביומן.'
  }

  return r.summary
}
