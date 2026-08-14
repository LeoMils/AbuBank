import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LiveTools, type LiveCalendarStore, type LiveEvent } from './liveTools'
import { listAllReminders, deleteReminder } from '../screens/AbuCalendar/reminders/reminderStore'
import type { ParsedFunctionCall } from '../screens/AbuAI/realtime/realtimeFunctionBridge'

// In-memory localStorage (the reminder store round-trips against it — same as reminderStore.test).
let store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = String(v) },
  removeItem: (k: string) => { delete store[k] },
  clear: () => { store = {} },
})
beforeEach(() => { store = {} })

const loadReminders = () => listAllReminders()
const clearReminders = () => { for (const r of listAllReminders()) deleteReminder(r.id) }

function memStore(): LiveCalendarStore {
  const items: LiveEvent[] = []; let n = 0
  return { list: () => items.slice(), add: (e) => { const ev = { ...e, id: `e${++n}` }; items.push(ev); return ev }, update: (id, p) => { const i = items.findIndex((x) => x.id === id); if (i < 0) return null; items[i] = { ...items[i]!, ...p }; return items[i]! } }
}
function fire(text: string) {
  const sent: Array<Record<string, unknown>> = []
  const tools = new LiveTools((e) => sent.push(e), memStore())
  tools.handleFunctionCall({ name: 'set_reminder', callId: `c${Math.random()}`, argsJson: JSON.stringify({ text }) } as ParsedFunctionCall)
  const item = sent.find((e) => e.type === 'conversation.item.create')?.item as { output?: string } | undefined
  return JSON.parse(item?.output ?? '{}') as Record<string, unknown>
}

describe('set_reminder tool — durable reminders on the live path (queue #2)', () => {
  it('is registered as a live tool', () => {
    expect(LiveTools.owns('set_reminder')).toBe(true)
  })

  it('a RELATIVE reminder ("בעוד דקה") is created + persisted, never "I cannot"', () => {
    clearReminders()
    const o = fire('תזכירי לי בעוד דקה לשתות מים')
    expect(o.status).toBe('reminder_set')
    expect(loadReminders().length).toBe(1)
    expect(JSON.stringify(o.allowed_to_say)).toMatch(/NEVER say you cannot set a reminder/i)
    // the due time is in the (near) future
    expect(new Date(loadReminders()[0]!.dueAt).getTime()).toBeGreaterThan(Date.now() - 5000)
  })

  it('an ABSOLUTE reminder ("מחר בשמונה בבוקר") is created', () => {
    clearReminders()
    const o = fire('תזכירי לי מחר בשמונה בבוקר לקחת את הכדור')
    expect(o.status).toBe('reminder_set')
    expect(loadReminders().length).toBe(1)
  })

  it('a recurring reminder ("כל בוקר בשמונה") is created with recurrence', () => {
    clearReminders()
    const o = fire('תזכירי לי כל בוקר בשמונה לקחת תרופה')
    expect(o.status).toBe('reminder_set')
    expect(loadReminders()[0]!.recurrence).toBeTruthy()
  })

  it('a reminder with NO time asks for it — does NOT refuse', () => {
    clearReminders()
    const o = fire('תזכירי לי להתקשר לרופאה')
    expect(o.status).toBe('needs_detail')
    expect(JSON.stringify(o.allowed_to_say)).toMatch(/NEVER say you cannot/i)
    expect(loadReminders().length).toBe(0)
  })
})
