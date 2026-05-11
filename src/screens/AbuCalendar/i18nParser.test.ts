/*
 * AbuCalendar P0 — deterministic Spanish + English parser contract.
 *
 * Phase 2 of the PR #28 strict pre-merge patch. The previous P0 fix
 * relied on the Hebrew-centric parseLocally for time/date extraction
 * and assumed Spanish/English would fall through to Groq. Without
 * Groq, the manual QA phrases produced null date/time → no event
 * silently. These tests pin the deterministic Spanish + English path
 * so the user's exact phone-QA phrases work even with no LLM.
 */

import { describe, it, expect } from 'vitest'
import { parseLocally } from './localParser'

const TODAY = '2026-05-11' // Monday — keep stable for relative dates.
const TOMORROW = '2026-05-12'
const NEXT_SUNDAY = '2026-05-17'
const NEXT_TUESDAY = '2026-05-12' // same day as TOMORROW since today is Mon... wait, today=Monday so tuesday is +1.

describe('AbuCalendar P0 — Spanish deterministic phrases', () => {
  it('"Agregá una reunión con Leo mañana a las cuatro" → tomorrow + 04:00 ambiguous', () => {
    const r = parseLocally('Agregá una reunión con Leo mañana a las cuatro', TODAY)
    expect(r.date).toBe(TOMORROW)
    expect(r.time).toBe('04:00')
    expect(r.ambiguousTime).toBe(true) // 4 needs AM/PM resolver
    expect(r.title).toContain('Leo')
  })

  it('"Agregá médico mañana a las diez" → tomorrow + 10:00 unambiguous', () => {
    const r = parseLocally('Agregá médico mañana a las diez', TODAY)
    expect(r.date).toBe(TOMORROW)
    expect(r.time).toBe('10:00')
    expect(r.ambiguousTime).toBe(false)
    expect(r.title.toLowerCase()).toContain('médico')
  })

  it('"Agendá médico mañana a las diez" — same as Agregá', () => {
    const r = parseLocally('Agendá médico mañana a las diez', TODAY)
    expect(r.date).toBe(TOMORROW)
    expect(r.time).toBe('10:00')
  })

  it('"Poneme médico mañana a las diez" — Rioplatense voseo variant', () => {
    const r = parseLocally('Poneme médico mañana a las diez', TODAY)
    expect(r.date).toBe(TOMORROW)
    expect(r.time).toBe('10:00')
  })

  it('"mañana a las cuatro" → ambiguous 04:00', () => {
    const r = parseLocally('mañana a las cuatro', TODAY)
    expect(r.date).toBe(TOMORROW)
    expect(r.time).toBe('04:00')
    expect(r.ambiguousTime).toBe(true)
  })

  it('"mañana a las diez" → 10:00 unambiguous', () => {
    const r = parseLocally('mañana a las diez', TODAY)
    expect(r.date).toBe(TOMORROW)
    expect(r.time).toBe('10:00')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"hoy a las seis" → today + 06:00 ambiguous', () => {
    const r = parseLocally('hoy a las seis', TODAY)
    expect(r.date).toBe(TODAY)
    expect(r.time).toBe('06:00')
    expect(r.ambiguousTime).toBe(true)
  })

  it('"el domingo a las diez" → next Sunday + 10:00', () => {
    const r = parseLocally('el domingo a las diez', TODAY)
    expect(r.date).toBe(NEXT_SUNDAY)
    expect(r.time).toBe('10:00')
  })

  it('"a las cuatro de la tarde" — explicit PM → 16:00 unambiguous', () => {
    const r = parseLocally('mañana a las cuatro de la tarde', TODAY)
    expect(r.time).toBe('16:00')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"a las diez de la mañana" — explicit AM → 10:00 unambiguous', () => {
    const r = parseLocally('mañana a las diez de la mañana', TODAY)
    expect(r.time).toBe('10:00')
    expect(r.ambiguousTime).toBe(false)
  })
})

describe('AbuCalendar P0 — English deterministic phrases', () => {
  it('"Add meeting with Gilad tomorrow at 4pm" → tomorrow + 16:00 unambiguous', () => {
    const r = parseLocally('Add meeting with Gilad tomorrow at 4pm', TODAY)
    expect(r.date).toBe(TOMORROW)
    expect(r.time).toBe('16:00')
    expect(r.ambiguousTime).toBe(false)
    expect(r.title).toContain('Gilad')
  })

  it('"Add meeting with Gilad tomorrow at 4" → ambiguous 04:00', () => {
    const r = parseLocally('Add meeting with Gilad tomorrow at 4', TODAY)
    expect(r.date).toBe(TOMORROW)
    expect(r.time).toBe('04:00')
    expect(r.ambiguousTime).toBe(true)
  })

  it('"tomorrow at 4pm" → tomorrow + 16:00', () => {
    const r = parseLocally('tomorrow at 4pm', TODAY)
    expect(r.date).toBe(TOMORROW)
    expect(r.time).toBe('16:00')
  })

  it('"tomorrow at 10am" → tomorrow + 10:00', () => {
    const r = parseLocally('tomorrow at 10am', TODAY)
    expect(r.date).toBe(TOMORROW)
    expect(r.time).toBe('10:00')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"next Tuesday at 10" → next Tuesday + 10:00 unambiguous', () => {
    const r = parseLocally('next Tuesday at 10', TODAY)
    expect(r.date).toBe(NEXT_TUESDAY)
    expect(r.time).toBe('10:00')
  })

  it('"at 4pm" alone with no date → time only', () => {
    const r = parseLocally('at 4pm', TODAY)
    expect(r.time).toBe('16:00')
    expect(r.date).toBeNull()
  })

  it('"at 4:30pm" with explicit minutes', () => {
    const r = parseLocally('tomorrow at 4:30pm', TODAY)
    expect(r.time).toBe('16:30')
  })

  it('"tomorrow at 10:00" — no AM/PM marker → 10:00 unambiguous (10 is not in the 1–6 ambiguity range)', () => {
    const r = parseLocally('tomorrow at 10:00', TODAY)
    expect(r.time).toBe('10:00')
    expect(r.ambiguousTime).toBe(false)
  })
})

describe('AbuCalendar P0 — Hebrew still works after the i18n patch', () => {
  it('"תוסיפי פגישה עם רופא מחר בארבע" — same as before', () => {
    const r = parseLocally('תוסיפי פגישה עם רופא מחר בארבע', TODAY)
    expect(r.date).toBe(TOMORROW)
    expect(r.time).toBe('04:00')
    expect(r.ambiguousTime).toBe(true)
    expect(r.title).toContain('רופא')
  })

  it('"תקבעי פגישה עם לאו ביום ראשון בעשר בבוקר" — Sunday at 10:00', () => {
    const r = parseLocally('תקבעי פגישה עם לאו ביום ראשון בעשר בבוקר', TODAY)
    expect(r.date).toBe(NEXT_SUNDAY)
    expect(r.time).toBe('10:00')
    expect(r.ambiguousTime).toBe(false)
  })

  it('"תוסיפי פגישה עם רופא מחר" — missing time, no silent default', () => {
    const r = parseLocally('תוסיפי פגישה עם רופא מחר', TODAY)
    expect(r.date).toBe(TOMORROW)
    expect(r.time).toBeNull()
  })
})

describe('AbuCalendar P0 — no Groq required for the deterministic phrases', () => {
  it('source contract: localParser does not call Groq', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const src = fs.readFileSync(path.resolve(__dirname, 'localParser.ts'), 'utf8')
    expect(src.includes('VITE_GROQ_API_KEY')).toBe(false)
    expect(src.includes('api.groq.com')).toBe(false)
  })
})
