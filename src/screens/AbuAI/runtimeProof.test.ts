/**
 * RUNTIME PROOF — Calendar storage → query pipeline end-to-end.
 * Adds a real appointment via addAppointment(), then queries every layer.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { addAppointment, loadAppointmentsWithFamily } from '../AbuCalendar/service'
import { getTomorrowEvents, getEventsByDate } from './tools'
import { tryGroundedAnswer } from './service'

function tomorrowLocal(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

describe('RUNTIME PROOF — end-to-end calendar pipeline', () => {
  let storage: Record<string, string> = {}

  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val },
      removeItem: (key: string) => { delete storage[key] },
    })
  })

  it('STEP 1: addAppointment stores to localStorage', () => {
    const tomorrow = tomorrowLocal()
    const appt = addAppointment({
      title: 'בדיקת יומן',
      date: tomorrow,
      time: '10:00',
      emoji: '📅',
    })

    console.log('=== STEP 1: addAppointment result ===')
    console.log(JSON.stringify(appt, null, 2))

    expect(appt.id).toBeTruthy()
    expect(appt.title).toBe('בדיקת יומן')
    expect(appt.date).toBe(tomorrow)
    expect(appt.time).toBe('10:00')
    expect(appt.color).toBeTruthy()

    // Verify localStorage
    const raw = storage['abubank-calendar-appointments']
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].title).toBe('בדיקת יומן')
    console.log('localStorage written: OK')
  })

  it('STEP 2: loadAppointmentsWithFamily finds the appointment', () => {
    const tomorrow = tomorrowLocal()
    addAppointment({ title: 'בדיקת יומן', date: tomorrow, time: '10:00', emoji: '📅' })

    const all = loadAppointmentsWithFamily(new Date().getFullYear())
    const match = all.filter(a => a.title === 'בדיקת יומן')

    console.log('=== STEP 2: loadAppointmentsWithFamily ===')
    console.log(`Total appointments: ${all.length}`)
    console.log(`Matches for "בדיקת יומן": ${match.length}`)
    console.log(JSON.stringify(match, null, 2))

    expect(match.length).toBe(1)
    expect(match[0]!.date).toBe(tomorrow)
  })

  it('STEP 3: getTomorrowEvents returns the appointment', () => {
    const tomorrow = tomorrowLocal()
    addAppointment({ title: 'בדיקת יומן', date: tomorrow, time: '10:00', emoji: '📅' })

    const result = getTomorrowEvents()

    console.log('=== STEP 3: getTomorrowEvents ===')
    console.log(`Events count: ${result.events.length}`)
    console.log(`Summary: ${result.summary}`)
    console.log('Events:', JSON.stringify(result.events.filter(e => e.title === 'בדיקת יומן'), null, 2))

    const userEvents = result.events.filter(e => !e.type || e.type === 'regular')
    expect(userEvents.some(e => e.title === 'בדיקת יומן')).toBe(true)
    expect(result.summary).toContain('בדיקת יומן')
  })

  it('STEP 4: tryGroundedAnswer("מה יש לי מחר?") returns the appointment', () => {
    const tomorrow = tomorrowLocal()
    addAppointment({ title: 'בדיקת יומן', date: tomorrow, time: '10:00', emoji: '📅' })

    const answer = tryGroundedAnswer('מה יש לי מחר?')

    console.log('=== STEP 4: tryGroundedAnswer("מה יש לי מחר?") ===')
    console.log(`Answer: ${answer}`)

    expect(answer).not.toBeNull()
    expect(answer).toContain('בדיקת יומן')
    expect(answer).toContain('בבוקר')
  })

  it('STEP 5: getEventsByDate(tomorrow) returns the appointment', () => {
    const tomorrow = tomorrowLocal()
    addAppointment({ title: 'בדיקת יומן', date: tomorrow, time: '10:00', emoji: '📅' })

    const result = getEventsByDate(tomorrow)

    console.log('=== STEP 5: getEventsByDate ===')
    console.log(`Events count: ${result.events.length}`)
    console.log(`Summary: ${result.summary}`)

    expect(result.events.some(e => e.title === 'בדיקת יומן')).toBe(true)
    expect(result.summary).toContain('בדיקת יומן')
  })

  it('STEP 6: empty state — tryGroundedAnswer returns "לא מצאתי"', () => {
    // No appointments added
    const answer = tryGroundedAnswer('מה יש לי מחר?')

    console.log('=== STEP 6: empty state ===')
    console.log(`Answer: ${answer}`)

    expect(answer).not.toBeNull()
    expect(answer).toContain('לא מצאתי')
  })

  it('STEP 7: multiple appointments — all appear', () => {
    const tomorrow = tomorrowLocal()
    addAppointment({ title: 'רופא', date: tomorrow, time: '10:00', emoji: '🏥' })
    addAppointment({ title: 'קניות', date: tomorrow, time: '14:00', emoji: '🛒' })

    const answer = tryGroundedAnswer('מה יש לי מחר?')

    console.log('=== STEP 7: multiple appointments ===')
    console.log(`Answer: ${answer}`)

    expect(answer).toContain('רופא')
    expect(answer).toContain('קניות')
    expect(answer).toContain('שני דברים')
  })
})
