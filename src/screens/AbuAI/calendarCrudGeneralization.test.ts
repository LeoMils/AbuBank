/**
 * CALENDAR CRUD — PROPERTY-BASED GENERALIZATION PROOF (principle C).
 * ══════════════════════════════════════════════════════════════════
 * Leo's mandate: prove calendar state + REFERABILITY generally, not on a few
 * hand-picked turns. This GENERATES random create / cancel / move sequences and
 * drives them through the REAL runtime (`runCognitiveTurn`, the same path the app
 * uses), asserting the store and referability hold every time.
 *
 * Evidence class: CODE (real runtime + real store round-trips, deterministic).
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { runCognitiveTurn, IDLE_RUNTIME, type RuntimeState } from './cognitiveRuntime'
import { loadAppointments, deleteAppointment } from '../AbuCalendar/service'

const FIXED = new Date('2026-06-24T09:00:00') // Wednesday
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
  vi.stubGlobal('navigator', { onLine: true })
})

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000 } }
const POOL = ['רפי', 'גבי', 'דנה', 'יוסי', 'מוטי', 'שרה', 'דוד', 'רונית']
function clearStore() { for (const a of loadAppointments()) deleteAppointment(a.id) }

function makeDriver() {
  let st: RuntimeState = IDLE_RUNTIME
  const msgs: Array<{ role: string; content: string }> = []
  return (text: string) => {
    const d = runCognitiveTurn(st, text, { messages: msgs, now: new Date() })
    st = d.state
    msgs.push({ role: 'user', content: text }); if (d.display) msgs.push({ role: 'assistant', content: d.display })
    return d
  }
}
/** Pick k distinct people deterministically from the pool. */
function pickPeople(r: () => number, k: number): string[] {
  const pool = [...POOL]; const out: string[] = []
  for (let i = 0; i < k && pool.length; i++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]!)
  return out
}

describe('CALENDAR_CRUD_GENERALIZATION — over generated sequences', () => {
  it('create K events → all persist (100 seeds)', () => {
    const bad: string[] = []
    for (let seed = 1; seed <= 100; seed++) {
      clearStore()
      const r = rng(seed); const drive = makeDriver()
      const people = pickPeople(r, 2 + Math.floor(r() * 3)) // 2..4
      for (const p of people) { drive(`תקבעי פגישה עם ${p} מחר בשלוש`); drive('כן') }
      const titles = loadAppointments().map((a) => a.title)
      if (loadAppointments().length !== people.length) bad.push(`seed ${seed}: want ${people.length} got ${titles.length} [${titles.join(', ')}]`)
      else for (const p of people) if (!titles.some((t) => t.includes(p))) bad.push(`seed ${seed}: missing ${p}`)
    }
    expect(bad).toEqual([])
  })

  it('cancel ONE by name removes only that event, others survive (100 seeds)', () => {
    const bad: string[] = []
    for (let seed = 200; seed < 300; seed++) {
      clearStore()
      const r = rng(seed); const drive = makeDriver()
      const people = pickPeople(r, 2 + Math.floor(r() * 3))
      for (const p of people) { drive(`תקבעי פגישה עם ${p} מחר בשלוש`); drive('כן') }
      const victim = people[Math.floor(r() * people.length)]!
      const d = drive(`תבטלי את הפגישה עם ${victim}`)
      const titles = loadAppointments().map((a) => a.title)
      if (d.intent !== 'calendar_delete') bad.push(`seed ${seed}: intent ${d.intent}`)
      if (titles.some((t) => t.includes(victim))) bad.push(`seed ${seed}: ${victim} not removed`)
      if (loadAppointments().length !== people.length - 1) bad.push(`seed ${seed}: want ${people.length - 1} got ${titles.length}`)
      for (const p of people) if (p !== victim && !titles.some((t) => t.includes(p))) bad.push(`seed ${seed}: lost ${p}`)
    }
    expect(bad).toEqual([])
  })

  it('REFERABILITY: create one → "תבטלי אותה" cancels exactly it → store empty (120 seeds)', () => {
    const bad: string[] = []
    for (let seed = 400; seed < 520; seed++) {
      clearStore()
      const p = POOL[seed % POOL.length]!
      const drive = makeDriver()
      drive(`תקבעי פגישה עם ${p} מחר בשלוש`); drive('כן')
      const d = drive('תבטלי אותה')
      if (d.intent !== 'calendar_delete') bad.push(`seed ${seed} (${p}): intent ${d.intent}`)
      if (loadAppointments().length !== 0) bad.push(`seed ${seed} (${p}): store not empty (${loadAppointments().length})`)
    }
    expect(bad).toEqual([])
  })

  it('REFERABILITY: create one → "תעבירי אותה ליום ראשון" moves it off tomorrow (120 seeds)', () => {
    const bad: string[] = []
    for (let seed = 700; seed < 820; seed++) {
      clearStore()
      const p = POOL[seed % POOL.length]!
      const drive = makeDriver()
      drive(`תקבעי פגישה עם ${p} מחר בשלוש`); drive('כן')
      const beforeDate = loadAppointments()[0]?.date
      const d = drive('תעבירי אותה ליום ראשון')
      const after = loadAppointments()[0]
      if (d.intent !== 'calendar_update') bad.push(`seed ${seed} (${p}): intent ${d.intent}`)
      if (!after || after.date === beforeDate) bad.push(`seed ${seed} (${p}): date unchanged (${after?.date})`)
      // Next Sunday from Wed 2026-06-24 is 2026-06-28.
      if (after && after.date !== '2026-06-28') bad.push(`seed ${seed} (${p}): want 2026-06-28 got ${after.date}`)
    }
    expect(bad).toEqual([])
  })
})
