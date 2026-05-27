import { describe, it, expect } from 'vitest'
import { processVoiceTranscript } from './voiceAutoCreate'

const TODAY = '2026-05-27'

describe('voice ADD — relationship phrase "הבת של מור"', () => {
  const r = processVoiceTranscript('תקבעי פגישה למחר בשעה 21 עם הבת של מור', TODAY)

  it('is gated to the confirmation card (never silently auto-created)', () => {
    expect(r.action).toBe('show_confirm_card')
  })

  it('captures the WHOLE phrase (not truncated to "הבת") and 21:00', () => {
    expect(r.action).toBe('show_confirm_card')
    if (r.action === 'show_confirm_card') {
      expect(r.draft.title).toContain('הבת של מור')
      expect(r.draft.title).not.toBe('פגישה עם הבת')
      expect(r.draft.personPhrase).toBe('הבת של מור')
      expect(r.draft.date).toBe('2026-05-28') // מחר
      expect(r.draft.time).toBe('21:00')
    }
  })
})

describe('voice ADD — "21" parses as 21:00', () => {
  it('bare 24h hour resolves to HH:00', () => {
    const r = processVoiceTranscript('תקבעי פגישה למחר בשעה 21', TODAY)
    // complete enough to reach confirm/auto path; in all cases time must be 21:00
    if (r.action === 'show_confirm_card' || r.action === 'needs_clarification' || r.action === 'needs_am_pm') {
      expect(r.draft.time).toBe('21:00')
    } else if (r.action === 'auto_created') {
      expect(r.appointment.time).toBe('21:00')
    }
  })
})
