import { type Appointment } from './service'

export const GOLD = '#C9A84C'
export const BRIGHT_GOLD = '#D4A853'
export const TEAL = '#14b8a6'
export const BG = '#050A18'
export const CREAM = '#F5F0E8'
// Solid text tokens (replace low-alpha text that fell below contrast targets).
export const TEXT_PRIMARY = '#F5F0E8'
export const TEXT_SECONDARY = '#D8D2C4'
export const TEXT_MUTED = '#9C9486'

export type ApptTimeState = 'past' | 'now' | 'today' | 'upcoming'

export const DAY_HEADERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'שבת']

export function getTodayStr(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
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
