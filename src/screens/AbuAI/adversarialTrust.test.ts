import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tryGroundedAnswer } from './service'
import { resolveRelationalQuery } from './relationalResolver'
import { findBannedPhrase } from './companionComposer'

function installLS() {
  const m = new Map<string, string>()
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(), key: () => null, length: 0,
  }
  return m
}
const RAW_JSON = /[{[]"?\w+"?\s*:/

describe('TRUST — family: all languages converge to the same graph truth', () => {
  it('"mother of Ofir" is Mor in HE, ES, EN', () => {
    const he = tryGroundedAnswer('מי אמא של אופיר?')
    const es = resolveRelationalQuery('la mamá de Ofir', 'es')
    const en = resolveRelationalQuery("Ofir's mother", 'en')
    expect(he).toContain('מור')
    expect(es).toContain('Mor')
    expect(en).toContain('Mor')
  })
  it('unknown / non-existent relation is never invented', () => {
    expect(resolveRelationalQuery('la hija de Leo', 'es')).toMatch(/no tiene/) // Leo has only sons
    expect(resolveRelationalQuery("Leo's daughter", 'en')).toMatch(/has no/)
    expect(resolveRelationalQuery('la mamá de Pedro', 'es')).toBeNull()        // unknown person
  })
})

describe('TRUST — output safety: no raw JSON / tool dump / banned register', () => {
  beforeEach(() => installLS())
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage })

  it('family + relational answers expose no raw internal output', () => {
    const answers = [
      tryGroundedAnswer('מי זאת מור?'),
      tryGroundedAnswer('ספרי לי על מור'),
      tryGroundedAnswer('מי דוד של אופיר?'),
      resolveRelationalQuery('la mamá de Ofir', 'es'),
      resolveRelationalQuery("Ofir's mother", 'en'),
    ]
    for (const a of answers) {
      expect(a).not.toBeNull()
      expect(findBannedPhrase(a!)).toBeNull()
      expect(RAW_JSON.test(a!)).toBe(false)
    }
  })
})

describe('TRUST — calendar: time-precise readback + no event leakage', () => {
  beforeEach(() => installLS())
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage })

  it('same title, same day, different time → readback matches the exact slot', async () => {
    const { createAppointmentSafe, loadAppointments } = await import('../AbuCalendar/service')
    createAppointmentSafe({ title: 'רופא', date: '2026-06-22', time: '11:00', notes: null, emoji: '🩺' } as never)
    createAppointmentSafe({ title: 'רופא', date: '2026-06-22', time: '16:00', notes: null, emoji: '🩺' } as never)
    const appts = loadAppointments()
    const at16 = appts.filter(a => a.title === 'רופא' && a.date === '2026-06-22' && a.time === '16:00')
    const at11 = appts.filter(a => a.title === 'רופא' && a.date === '2026-06-22' && a.time === '11:00')
    expect(at16).toHaveLength(1) // distinct slots, not collapsed
    expect(at11).toHaveLength(1)
  })

  it('before-time with no match → honest empty, no leakage from other times', () => {
    const storage = (globalThis.localStorage as Storage)
    const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
    storage.setItem('abubank-calendar-appointments', JSON.stringify([{ id: 'x', title: 'רופא', date: today, time: '16:00', emoji: '🏥', color: '#C9A84C' }]))
    const ans = tryGroundedAnswer('מה יש לי היום לפני 10?')
    expect(ans).not.toBeNull()
    expect(ans).not.toContain('רופא') // 16:00 event must not leak into a "before 10:00" answer
  })
})
