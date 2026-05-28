import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { confirmCanSave } from './ConfirmCard'

const SRC = readFileSync(resolve(__dirname, 'ConfirmCard.tsx'), 'utf8')
const VOICE = readFileSync(resolve(__dirname, 'VoiceCard.tsx'), 'utf8')
const MANUAL = readFileSync(resolve(__dirname, 'ManualModal.tsx'), 'utf8')
const SERVICE = readFileSync(resolve(__dirname, 'service.ts'), 'utf8')
const FAMILY_EVENTS = readFileSync(resolve(__dirname, 'familyEvents.ts'), 'utf8')

describe('ConfirmCard — save gate', () => {
  it('requires title + date + time', () => {
    expect(confirmCanSave({ title: 'רופא', date: '2026-05-15', time: '10:00' })).toBe(true)
    expect(confirmCanSave({ title: '', date: '2026-05-15', time: '10:00' })).toBe(false)
    expect(confirmCanSave({ title: 'רופא', date: null, time: '10:00' })).toBe(false)
    expect(confirmCanSave({ title: 'רופא', date: '2026-05-15', time: null })).toBe(false)
    expect(confirmCanSave({ title: '   ', date: '2026-05-15', time: '10:00' })).toBe(false)
  })
})

describe('ConfirmCard — senior-first action labels', () => {
  it('shows the three large clear actions', () => {
    expect(SRC).toMatch(/>\s*כן, לשמור\s*</)
    expect(SRC).toMatch(/>\s*לא, לתקן\s*</)
    expect(SRC).toMatch(/>\s*ביטול\s*</)
    expect(SRC).toContain('data-testid="confirm-save-btn"')
    expect(SRC).toContain('data-testid="confirm-correct-btn"')
    expect(SRC).toContain('data-testid="confirm-cancel-btn"')
  })

  it('summarizes only title/date/time/person — no transcript, no private notes/location', () => {
    expect(SRC).toContain('data-testid="confirm-summary"')
    // never renders a transcript box or private fields
    expect(SRC).not.toContain('transcript-box')
    expect(SRC).not.toContain('transcript-textarea')
    expect(SRC).not.toContain('rawTranscript')
    expect(SRC).not.toMatch(/draft\.notes/)
    expect(SRC).not.toMatch(/draft\.location/)
  })
})

describe('ConfirmCard — clean structured summary (no narrative blob)', () => {
  it('uses a structured headline + question, not a dumped readback sentence', () => {
    expect(SRC).toMatch(/>\s*הבנתי\s*</)
    expect(SRC).toMatch(/>\s*לשמור ביומן\?\s*</)
    expect(SRC).toContain('data-testid="confirm-question"')
  })

  it('handles resolved / ambiguous / missing family relations', () => {
    expect(SRC).toContain('data-testid="relation-secondary"')   // resolved → show original phrase
    expect(SRC).toContain('data-testid="relation-candidate"')   // ambiguous → candidate buttons
    expect(SRC).toContain('data-testid="relation-keep"')        // ambiguous → keep literal phrase
    expect(SRC).toContain('data-testid="relation-missing"')     // missing → preserve, never invent
    expect(SRC).toMatch(/למי התכוונת\?/)
    expect(SRC).toContain('לא מצאתי בוודאות מי')
    expect(SRC).toContain('להשאיר כמו שאמרתי')
  })
})

describe('ConfirmCard — shared by voice and manual', () => {
  it('voice flow uses ConfirmCard as the default (non-editing) confirmation', () => {
    expect(VOICE).toContain("import { ConfirmCard } from './ConfirmCard'")
    expect(VOICE).toContain('<ConfirmCard')
    expect(VOICE).toMatch(/!editing[\s\S]*<ConfirmCard/)
    expect(VOICE).toContain('onConfirm={doSave}')
    expect(VOICE).toContain('onCorrect={() => setEditing(true)}')
  })

  it('manual flow routes through ConfirmCard before saving (no silent save)', () => {
    expect(MANUAL).toContain("import { ConfirmCard } from './ConfirmCard'")
    expect(MANUAL).toContain('<ConfirmCard')
    expect(MANUAL).toContain('setConfirming(true)')
    expect(MANUAL).toContain('onConfirm={doManualSave}')
    // handleSave no longer saves directly; doManualSave is the only onSave caller
    expect(MANUAL).toMatch(/function doManualSave/)
    expect(MANUAL).toContain('onSave(appt)')
  })
})

describe('War-room invariants', () => {
  it('createAppointmentSafe is the only public create function in service.ts', () => {
    expect(SERVICE).toMatch(/export\s+function\s+createAppointmentSafe\s*\(/)
    // No other exported createAppointment* variant must exist.
    expect(SERVICE).not.toMatch(/export\s+function\s+createAppointment\b(?!Safe)/)
  })

  it('Papi / Pepe remembrance uses a candle (🕯️), not a cake — deceased flag controls the emoji', () => {
    expect(FAMILY_EVENTS).toContain('🕯️')
    // The deceased→candle / living→cake rule must remain in this file.
    expect(FAMILY_EVENTS).toMatch(/deceased\s*\?\s*'🕯️'/)
    // Memorial-date events must always render the candle.
    expect(FAMILY_EVENTS).toMatch(/יום הזיכרון של \$\{name\} 🕯️/)
  })
})
