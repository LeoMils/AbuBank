import type { RouteType } from './router'
import type { Appointment } from '../AbuCalendar/service'
import type { FamilyMember } from '../../services/familyLoader'
import { shapeNotFound, shapeToolError } from './responseShaper'

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
  if (!result.ok) return shapeToolError()

  if (route === 'family_lookup') {
    const r = result as FamilyToolResult
    if (!r.found || r.members.length === 0) return shapeNotFound()
    return r.answer
  }

  const r = result as CalendarToolResult
  return r.summary
}
