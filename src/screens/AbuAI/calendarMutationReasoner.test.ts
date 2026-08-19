/*
 * Calendar mutation domains proven THROUGH the Executive Controller:
 * reminders, recurring, delete, modify — legacy modules used only as tools.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from './cognitiveRuntime'
import { isFinalized } from './runtimeTrace'
import { addAppointment, loadAppointments, saveAppointments } from '../AbuCalendar/service'
import type { FullTurnTools } from './runtimeFullTurn'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}

const NOW = new Date(2026, 6, 3, 9, 0, 0)
const T: FullTurnTools = { llm: async () => 'x', online: async () => ({ ok: true, answer: 'x' }) }
const turn = (state: RuntimeState, input: string) => ExecutiveCognitiveController.handleTurn(state, input, { messages: [], now: NOW }, T)

describe('Calendar mutation domains — controller-reasoned', () => {
  beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage(); saveAppointments([]) })

  it('reminder: create → confirm → saved, finalized', async () => {
    const r1 = await turn(IDLE_RUNTIME, 'תזכירי לי מחר בשמונה בבוקר לקחת תרופות')
    expect(r1.intent).toBe('reminder')
    expect(r1.state.pendingReminder).not.toBeNull()
    expect(/לשמור|מתי/.test(r1.display)).toBe(true)
    const r2 = await turn(r1.state, 'כן')
    expect(r2.sideEffect).toBe('saved_reminder')
    expect(isFinalized(r2.trace)).toBe(true)
    expect(r2.state.pendingReminder).toBeNull()
  })

  it('recurring: "כל יום שלישי" creates 4 events, finalized', async () => {
    const r = await turn(IDLE_RUNTIME, 'תקבעי יוגה כל יום שלישי בעשר בבוקר')
    expect(r.intent).toBe('calendar_recurring')
    expect(r.sideEffect).toBe('saved_recurring')
    expect(loadAppointments().length).toBe(4)
    expect(isFinalized(r.trace)).toBe(true)
  })

  it('delete: removes the matched event, finalized', async () => {
    addAppointment({ title: 'פגישה עם דני', date: '2026-07-04', time: '08:00', emoji: '📅' })
    const r = await turn(IDLE_RUNTIME, 'תמחקי את הפגישה עם דני')
    expect(r.intent).toBe('calendar_delete')
    expect(r.sideEffect).toBe('deleted')
    expect(loadAppointments().length).toBe(0)
    expect(/מחקתי/.test(r.display)).toBe(true)
  })

  it('modify: updates the time, finalized', async () => {
    addAppointment({ title: 'פגישה עם דני', date: '2026-07-04', time: '08:00', emoji: '📅' })
    const r = await turn(IDLE_RUNTIME, 'תשני את הפגישה עם דני לשעה תשע')
    expect(r.intent).toBe('calendar_update')
    expect(r.sideEffect).toBe('updated')
    expect(loadAppointments()[0]!.time).toBe('09:00')
    expect(isFinalized(r.trace)).toBe(true)
  })

  it('reminder pending is not cancelled by an audio complaint', async () => {
    const r1 = await turn(IDLE_RUNTIME, 'תזכירי לי מחר בשמונה בבוקר לקחת תרופות')
    const r2 = await turn(r1.state, 'לא שמעתי')
    expect(r2.intent).toBe('audio_complaint')
    expect(r2.state.pendingReminder).not.toBeNull()
  })
})
