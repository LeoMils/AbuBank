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

describe('voice ADD — spouse phrase "הבעל של אופיר"', () => {
  for (const t of [
    'תקבעי פגישה למחר בשעה 21 עם הבעל של אופיר',
    'קבעי פגישה מחר ב-21 עם בעלה של אופיר',
  ]) {
    const r = processVoiceTranscript(t, TODAY)
    it(`gated to confirm + full phrase captured: "${t}"`, () => {
      expect(r.action).toBe('show_confirm_card')
      if (r.action === 'show_confirm_card') {
        expect(r.draft.personPhrase).toMatch(/של אופיר$/)
        // No command verb ever in the title/person.
        expect(r.draft.title).not.toMatch(/תקבע|קבע|תזכיר|שימי|תוסיפ|תרשמ|תקווה/)
        expect(r.draft.personPhrase).not.toMatch(/תקבע|קבע|תזכיר|תקווה/)
        expect(r.draft.time).toBe('21:00')
      }
    })
  }
})

describe('voice ADD — command verbs never leak into the title', () => {
  for (const t of [
    'תקבעי פגישה עם דנה מחר בשעה 21',
    'תזכירי לי ללכת לרופא מחר בשעה 9',
    'שימי לי פגישה עם דנה מחר בשעה 21',
    'תוסיפי פגישה עם דנה מחר בשעה 21',
    'תכניסי לי פגישה עם דנה מחר בשעה 21',
    'תכניס פגישה עם דנה מחר בשעה 21',
  ]) {
    it(`no verb / "תקווה" in title: "${t}"`, () => {
      const r = processVoiceTranscript(t, TODAY)
      const title = ('draft' in r ? r.draft.title : 'appointment' in r ? r.appointment.title : '') ?? ''
      expect(title).not.toMatch(/^(תקבע|תקבעי|קבע|קבעי|תזכיר|תזכירי|שימי|שים|תוסיפ|תרשמ)/)
      expect(title).not.toContain('תקווה')
    })
  }
})

describe('voice ADD — "תזכירי לי להתקשר לבעל של אופיר מחר בתשע בערב" (item 3)', () => {
  const r = processVoiceTranscript('תזכירי לי להתקשר לבעל של אופיר מחר בתשע בערב', TODAY)
  it('captures the spouse phrase even with "ל" prefix, no command-verb leak, 21:00', () => {
    expect(['show_confirm_card', 'auto_created', 'needs_clarification']).toContain(r.action)
    const title = ('draft' in r ? r.draft.title : 'appointment' in r ? r.appointment.title : '') ?? ''
    expect(title).not.toMatch(/^(תזכיר|תזכירי|תקבע|תקבעי|קבע|קבעי|שימי|תוסיפ|תרשמ)/)
    expect(title).not.toContain('תקווה')
    if (r.action === 'show_confirm_card' || r.action === 'needs_clarification') {
      expect(r.draft.personPhrase).toMatch(/של אופיר$/)
      expect(r.draft.time).toBe('21:00') // תשע בערב
    } else if (r.action === 'auto_created') {
      expect(r.appointment.time).toBe('21:00')
    }
  })

  it('resolvePersonPhrase("לבעל של אופיר") → גלעד', async () => {
    const { resolvePersonPhrase } = await import('./familyResolve')
    const res = resolvePersonPhrase('לבעל של אופיר')
    expect(res.status).toBe('resolved')
    if (res.status === 'resolved') expect(res.name).toBe('גלעד')
  })
})

describe('voice ADD — direct name "תקבעי פגישה למחר בשעה 21 עם אופיר" (item 6)', () => {
  const r = processVoiceTranscript('תקבעי פגישה למחר בשעה 21 עם אופיר', TODAY)
  it('clean title, no verb leak, time 21:00', () => {
    const title = ('draft' in r ? r.draft.title : 'appointment' in r ? r.appointment.title : '') ?? ''
    expect(title).toContain('אופיר')
    expect(title).not.toContain('תקבעי')
    expect(title).not.toContain('תקווה')
    if (r.action === 'auto_created') expect(r.appointment.time).toBe('21:00')
    else if ('draft' in r) expect(r.draft.time).toBe('21:00')
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
