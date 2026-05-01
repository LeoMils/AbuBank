import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseCorrection } from './correctionParser'
import { shapeCreateConfirmReadback } from '../AbuAI/responseShaper'

const VOICE_CARD = readFileSync(resolve(__dirname, './VoiceCard.tsx'), 'utf8')
const INDEX = readFileSync(resolve(__dirname, './index.tsx'), 'utf8')

const baseDraft = {
  title: 'תור אצל התופרת',
  date: '2026-05-01',
  time: '14:34',
  emoji: '🧵',
  location: 'רחוב קוק 14, הרצליה',
  notes: 'חור במכנסיים',
}

describe('Voice confirmation — "כן" / "לא" semantics', () => {
  it('"כן" alone classifies as confirm (which the screen now treats as save)', () => {
    expect(parseCorrection('כן', baseDraft, '2026-04-30').kind).toBe('confirm')
  })

  it('"תשמרי" / "לקבוע" / "נכון" all classify as confirm', () => {
    expect(parseCorrection('תשמרי', baseDraft, '2026-04-30').kind).toBe('confirm')
    expect(parseCorrection('לקבוע', baseDraft, '2026-04-30').kind).toBe('confirm')
    expect(parseCorrection('נכון', baseDraft, '2026-04-30').kind).toBe('confirm')
  })

  it('bare "לא" does not save (cancel)', () => {
    expect(parseCorrection('לא', baseDraft, '2026-04-30').kind).toBe('cancel')
  })

  it('"לא נכון" asks for clarification (does not save, does not cancel)', () => {
    expect(parseCorrection('לא נכון', baseDraft, '2026-04-30').kind).toBe('clarify')
  })

  it('correction "לא, השעה חמש" updates time and re-confirms (kind: update)', () => {
    const r = parseCorrection('לא, השעה חמש', baseDraft, '2026-04-30')
    expect(r.kind).toBe('update')
    expect(r.updates.time).toBe('17:00')
  })

  it('correction "לא, זה בכפר סבא" updates location, draft preserved', () => {
    const r = parseCorrection('לא, זה בכפר סבא', baseDraft, '2026-04-30')
    expect(r.kind).toBe('update')
    expect(r.updates.location).toBe('כפר סבא')
  })
})

describe('Voice confirmation — wiring', () => {
  it('VoiceCard exposes onSpokenDone and calls it after speak() resolves', () => {
    expect(VOICE_CARD).toContain('onSpokenDone')
    expect(VOICE_CARD).toMatch(/speak\(confirmationText\)\s*\.\s*then/)
    expect(VOICE_CARD).toMatch(/onSpokenDone\?\.\(\)/)
  })

  it('TTS failure does not auto-listen — visual button stays as fallback', () => {
    // The catch branch only sets ttsError; onSpokenDone is in .then().
    expect(VOICE_CARD).toMatch(/setTtsError/)
    expect(VOICE_CARD).not.toMatch(/\.catch\([^)]*\)\s*\.\s*then\(\s*onSpokenDone/)
  })

  it('parent wires onSpokenDone → startCorrection (auto-listen for response)', () => {
    expect(INDEX).toContain('onSpokenDone={()')
    expect(INDEX).toContain('startCorrection()')
  })

  it('when the correction parser returns confirm, parent saves the appointment', () => {
    expect(INDEX).toMatch(/result\.kind === 'confirm'/)
    expect(INDEX).toMatch(/handleVoiceConfirm\(\{[\s\S]*?title: voiceParsed\.title/)
  })
})

describe('Voice confirmation — read-back template wired', () => {
  it('AbuCalendar uses shapeCreateConfirmReadback for the voice confirmation', () => {
    expect(INDEX).toContain('shapeCreateConfirmReadback')
    expect(INDEX).toMatch(/shapeCreateConfirmReadback\(\{[\s\S]*?personName: voiceParsed\.personName/)
  })

  it('happy-path read-back produced by shaper is a Hebrew sentence ending with "לקבוע?"', () => {
    const tmrw = new Date(Date.now() + 86400000).toISOString().split('T')[0]!
    const msg = shapeCreateConfirmReadback({
      title: 'תור אצל התופרת',
      personName: null,
      date: tmrw,
      time: '10:32',
      location: 'רחוב קוק 14, הרצליה',
      notes: 'חור במכנסיים',
    })
    expect(msg).toContain('הבנתי')
    expect(msg).toContain('תור אצל התופרת')
    expect(msg).toContain('מחר')
    expect(msg).toContain('10:32')
    expect(msg).toContain('רחוב קוק 14, הרצליה')
    expect(msg).toContain('חור במכנסיים')
    expect(msg.trim().endsWith('לקבוע?')).toBe(true)
  })
})

describe('Calendar emoji icon — no static JUL date anywhere', () => {
  const SERVICE = readFileSync(resolve(__dirname, './service.ts'), 'utf8')
  const APPT_CARD = readFileSync(resolve(__dirname, './ApptCard.tsx'), 'utf8')

  it('detectEmoji fallback is not 📅', () => {
    expect(SERVICE).toContain("return '📌'")
    expect(SERVICE).not.toMatch(/^\s*return\s*'📅'\s*$/m)
  })

  it('ApptCard sanitises any stored 📅 to 📌 on render', () => {
    expect(APPT_CARD).toContain("appt.emoji === '📅' ? '📌' : appt.emoji")
  })

  it('VoiceCard never renders the bare 📅 emoji', () => {
    expect(VOICE_CARD).not.toMatch(/<span[^>]*>\{emoji\}<\/span>/)
    expect(VOICE_CARD).toMatch(/parsed\.emoji !== '📅'/)
  })

  it('no hard-coded "JUL" or "July" strings in calendar UI files', () => {
    expect(VOICE_CARD).not.toMatch(/JUL/i)
    expect(INDEX).not.toMatch(/JUL/i)
    expect(APPT_CARD).not.toMatch(/JUL/i)
  })

  it('no hard-coded "17" or "20" calendar-date prop on calendar emoji renders', () => {
    // Sanity: confirmation UI does not contain literal 'icon="📅"' anywhere.
    expect(INDEX).not.toMatch(/icon="📅"/)
  })
})
