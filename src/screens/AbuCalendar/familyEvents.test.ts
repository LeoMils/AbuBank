import { describe, it, expect } from 'vitest'
import { buildFamilyBirthdays, buildFamilyMemorials, FAMILY_BIRTHDAYS, FAMILY_MEMORIALS } from './familyEvents'

describe('family birthdays from family_data.json', () => {
  const bdays = buildFamilyBirthdays()

  it('produces exactly the 13 people who have a verified birthday in the JSON', () => {
    expect(bdays.length).toBe(13)
    expect(FAMILY_BIRTHDAYS.length).toBe(13)
  })

  it('includes the expected people by canonical Hebrew name', () => {
    const names = bdays.map(b => b.personName)
    for (const n of ['אופיר', 'אדר', 'עדי', 'נועם', 'עילי', 'פפי', 'רפי', 'איילון', 'מור', 'לאו', 'אנאבל', 'ארי']) {
      expect(names).toContain(n)
    }
  })

  it('keeps Martita in Latin script (product rule)', () => {
    const martita = bdays.find(b => b.id === 'bday-martita')
    expect(martita).toBeDefined()
    expect(martita?.personName).toBe('Martita')
    expect(martita?.title).toBe('יום הולדת Martita 🎂')
  })

  it('uses the JSON canonical names, not the old aliases', () => {
    // personName is the JSON canonical (עילי/איילון), while the event id keeps
    // the legacy slug (bday-ilai/bday-eylon) for alert-dedup continuity (RT-3).
    expect(bdays.find(b => b.personName === 'איילון')?.id).toBe('bday-eylon')
    expect(bdays.find(b => b.personName === 'עילי')?.id).toBe('bday-ilai')
  })

  it('DROPS people with no birthday in the JSON — Yarden, Sharon, Yael', () => {
    for (const dropped of ['ירדן', 'שרון', 'יעל']) {
      expect(bdays.some(b => b.personName === dropped || b.title.includes(dropped))).toBe(false)
    }
    // and no stale hard-coded dates leak back in
    expect(bdays.some(b => b.date.endsWith('-10-12'))).toBe(false) // Yarden
    expect(bdays.some(b => b.date.endsWith('-09-11'))).toBe(false) // Sharon
  })

  it('every event is well-formed; living = cake birthday, deceased = candle remembrance', () => {
    for (const b of bdays) {
      expect(b.isRecurring).toBe(true)
      expect(b.time).toBe('09:00')
      expect(b.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(b.personName).toBeTruthy()
      expect(b.personName).not.toContain('יום הולדת')
      expect(b.id).toMatch(/^bday-/)
      if (b.type === 'birthday') {
        expect(b.emoji).toBe('🎂')
      } else {
        expect(b.type).toBe('memory')
        expect(b.emoji).toBe('🕯️')
      }
    }
  })

  it('RT-1: the deceased (Papi) birthday is a candle remembrance, never a cake', () => {
    const papi = bdays.find(b => b.personName === 'פפי')
    expect(papi).toBeDefined()
    expect(papi?.type).toBe('memory')
    expect(papi?.emoji).toBe('🕯️')
    expect(papi?.type).not.toBe('birthday')
    expect(papi?.emoji).not.toBe('🎂')
  })

  it('renders no private fields (no notes / location) into events', () => {
    for (const b of bdays) {
      expect(b.notes).toBeUndefined()
      expect(b.location).toBeUndefined()
    }
  })

  it('assigns deterministic, session-stable colors', () => {
    const a = buildFamilyBirthdays()
    const c = buildFamilyBirthdays()
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.color).toBe(c[i]!.color)
    }
  })
})

describe('family memorial from family_data.json', () => {
  const memorials = buildFamilyMemorials()

  it("produces Papi's memorial (01-01) and nothing else", () => {
    expect(memorials.length).toBe(1)
    expect(FAMILY_MEMORIALS.length).toBe(1)
    const m = memorials[0]!
    expect(m.personName).toBe('פפי')
    expect(m.type).toBe('memory')
    expect(m.isRecurring).toBe(true)
    expect(m.emoji).toBe('🕯️')
    expect(m.date).toMatch(/^\d{4}-01-01$/)
    expect(m.id).toBe('memorial-papi')
  })

  it('does not leak the deceased notes/biographical detail into the event', () => {
    expect(memorials[0]!.notes).toBeUndefined()
    expect(memorials[0]!.location).toBeUndefined()
  })
})
