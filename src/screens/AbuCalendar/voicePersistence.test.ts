import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { addAppointment, loadAppointments, type Appointment } from './service'
import { parseCorrection, applyCorrection, type DraftLike } from './correctionParser'
import { ApptCard } from './ApptCard'

const TODAY = '2026-04-30'

const baseDraft: DraftLike = {
  title: 'תור אצל התופרת',
  date: '2026-05-01',
  time: '14:34',
  emoji: '🧵',
  location: 'רחוב קוק 14, הרצליה',
  notes: 'חור במכנסיים',
}

// Mirror the real save shape used by handleVoiceConfirm in index.tsx.
function saveLikeVoiceConfirm(draft: DraftLike): Appointment {
  if (!draft.title || !draft.date || !draft.time) {
    throw new Error('save preconditions not met')
  }
  return addAppointment({
    title: draft.title,
    date: draft.date,
    time: draft.time,
    emoji: draft.emoji,
    ...(draft.location ? { location: draft.location } : {}),
    ...(draft.notes ? { notes: draft.notes } : {}),
  })
}

describe('Voice flow — end-to-end persistence', () => {
  let storage: Record<string, string> = {}

  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val },
      removeItem: (key: string) => { delete storage[key] },
    })
  })

  it('"כן" persists every field that the parser extracted (title/date/time/location/notes)', () => {
    const r = parseCorrection('כן', baseDraft, TODAY)
    expect(r.kind).toBe('confirm')

    const saved = saveLikeVoiceConfirm(baseDraft)
    const all = loadAppointments()
    expect(all).toHaveLength(1)
    const stored = all[0]!
    expect(stored.title).toBe('תור אצל התופרת')
    expect(stored.date).toBe('2026-05-01')
    expect(stored.time).toBe('14:34')
    expect(stored.location).toBe('רחוב קוק 14, הרצליה')
    expect(stored.notes).toBe('חור במכנסיים')
    expect(stored.emoji).toBe('🧵')
    // id/color exist; not asserting exact values.
    expect(stored.id).toBeTruthy()
    expect(saved.id).toBe(stored.id)
  })

  it('bare "לא" results in cancel-kind and no appointment is persisted', () => {
    const r = parseCorrection('לא', baseDraft, TODAY)
    expect(r.kind).toBe('cancel')
    // The screen only calls addAppointment when kind === 'confirm'.
    // Simulate the real branch: do not save on cancel.
    if (r.kind !== 'cancel') saveLikeVoiceConfirm(baseDraft)
    expect(loadAppointments()).toHaveLength(0)
  })

  it('correction → yes saves the CORRECTED draft, not the original', () => {
    // Step 1: user says "לא, השעה חמש" against a 14:34 PM draft → 17:00 inherits PM.
    const correction = parseCorrection('לא, השעה חמש', baseDraft, TODAY)
    expect(correction.kind).toBe('update')
    expect(correction.updates.time).toBe('17:00')
    const merged = applyCorrection(baseDraft, correction.updates)
    expect(merged.time).toBe('17:00')
    expect(merged.location).toBe('רחוב קוק 14, הרצליה') // location preserved through merge
    expect(merged.notes).toBe('חור במכנסיים')           // notes preserved through merge

    // Step 2: user then says "כן" → save uses the corrected draft.
    const yes = parseCorrection('כן', merged, TODAY)
    expect(yes.kind).toBe('confirm')
    saveLikeVoiceConfirm(merged)

    const stored = loadAppointments()[0]!
    expect(stored.time).toBe('17:00')
    expect(stored.title).toBe('תור אצל התופרת')
    expect(stored.location).toBe('רחוב קוק 14, הרצליה')
    expect(stored.notes).toBe('חור במכנסיים')
  })

  it('"לא נכון" alone does not save and does not cancel — draft survives for the next correction', () => {
    const r = parseCorrection('לא נכון', baseDraft, TODAY)
    expect(r.kind).toBe('clarify')
    if ((r.kind as string) !== 'clarify') saveLikeVoiceConfirm(baseDraft)
    expect(loadAppointments()).toHaveLength(0)
  })
})

describe('ApptCard — real React render via renderToStaticMarkup', () => {
  function makeAppt(overrides: Partial<Appointment> = {}): Appointment {
    return {
      id: 'appt-test',
      title: 'תור אצל התופרת',
      date: '2026-05-01',
      time: '14:34',
      emoji: '🧵',
      color: '#C9A84C',
      ...overrides,
    }
  }

  it('renders appt.location text inside the rendered HTML when present', () => {
    const html = renderToStaticMarkup(createElement(ApptCard, {
      appt: makeAppt({ location: 'רחוב קוק 14, הרצליה' }),
    }))
    expect(html).toContain('רחוב קוק 14, הרצליה')
    expect(html).toContain('📍')
    expect(html).toContain('data-testid="appt-location"')
  })

  it('does not render the location row when appt.location is absent', () => {
    const html = renderToStaticMarkup(createElement(ApptCard, { appt: makeAppt() }))
    expect(html).not.toContain('data-testid="appt-location"')
    expect(html).not.toContain('📍')
  })

  it('renders appt.notes inside the rendered HTML when present', () => {
    const html = renderToStaticMarkup(createElement(ApptCard, {
      appt: makeAppt({ notes: 'חור במכנסיים' }),
    }))
    expect(html).toContain('חור במכנסיים')
  })

  it('renders both location and notes together, in order (location above notes)', () => {
    const html = renderToStaticMarkup(createElement(ApptCard, {
      appt: makeAppt({ location: 'רחוב קוק 14, הרצליה', notes: 'חור במכנסיים' }),
    }))
    const locIdx = html.indexOf('רחוב קוק 14, הרצליה')
    const noteIdx = html.indexOf('חור במכנסיים')
    expect(locIdx).toBeGreaterThan(-1)
    expect(noteIdx).toBeGreaterThan(-1)
    expect(locIdx).toBeLessThan(noteIdx)
  })

  it('sanitises a stored 📅 to 📌 in the rendered HTML (no JUL 17 glyph)', () => {
    const html = renderToStaticMarkup(createElement(ApptCard, {
      appt: makeAppt({ emoji: '📅' }),
    }))
    expect(html).not.toContain('📅')
    expect(html).toContain('📌')
    expect(html).not.toMatch(/JUL/i)
  })

  it('does not introduce a bare 📅 even when emoji is empty / undefined', () => {
    const html = renderToStaticMarkup(createElement(ApptCard, {
      appt: makeAppt({ emoji: '' as unknown as string }),
    }))
    expect(html).not.toContain('📅')
    expect(html).not.toMatch(/JUL/i)
  })
})

describe('ApptCard — static-source proof (kept as defense-in-depth)', () => {
  const SOURCE = readFileSync(resolve(__dirname, './ApptCard.tsx'), 'utf8')

  it('source binds appt.location and the test-id', () => {
    expect(SOURCE).toContain('appt.location')
    expect(SOURCE).toContain('data-testid="appt-location"')
    expect(SOURCE).toContain('{appt.location}')
  })

  it('source keeps the 📅 → 📌 sanitiser', () => {
    expect(SOURCE).toContain("appt.emoji === '📅' ? '📌' : appt.emoji")
  })
})
