import { type Appointment } from './service'

export const GOLD = '#C9A84C'
export const BRIGHT_GOLD = '#D4A853'
export const TEAL = '#14b8a6'
export const BG = '#050A18'
export const CREAM = '#F5F0E8'

export type ApptTimeState = 'past' | 'now' | 'today' | 'upcoming'

export const DAY_HEADERS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0]!
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

export function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function isFamily(a: Appointment): boolean {
  return a.type === 'birthday' || a.type === 'memory'
}

export function getTimeState(apptDate: string, apptTime: string, today: string, nowMs: number): ApptTimeState {
  const apptDateTime = new Date(`${apptDate}T${apptTime}:00`).getTime()
  if (isNaN(apptDateTime)) return 'upcoming'
  if (apptDateTime < nowMs) return 'past'
  if (apptDateTime <= nowMs + 10 * 60 * 1000) return 'now'
  if (apptDate === today) return 'today'
  return 'upcoming'
}

export function isDuplicate(title: string, date: string, time: string, existingAppts: Appointment[]): boolean {
  const normalizedTitle = title.trim().toLowerCase()
  return existingAppts.some(a =>
    a.title.trim().toLowerCase() === normalizedTitle && a.date === date && a.time === time
  )
}
