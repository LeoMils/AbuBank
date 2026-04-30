import { describe, it, expect } from 'vitest'
import { parseCorrection, applyCorrection, type DraftLike } from './correctionParser'

const TODAY = '2026-04-30'

const baseDraft: DraftLike = {
  title: 'תור אצל התופרת',
  date: '2026-05-01',
  time: '14:34',
  emoji: '🧵',
  location: 'רחוב קוק 14, הרצליה',
  notes: 'חור במכנסיים',
}

describe('parseCorrection — time correction', () => {
  it('"לא, זה בשלוש" updates time and inherits PM from current draft', () => {
    const r = parseCorrection('לא, זה בשלוש', baseDraft, TODAY)
    expect(r.kind).toBe('update')
    expect(r.updates.time).toBe('15:00')
  })

  it('"לא, זה בשלוש בבוקר" → 03:00 not PM-inherited', () => {
    const r = parseCorrection('לא, זה בשלוש בבוקר', baseDraft, TODAY)
    expect(r.kind).toBe('update')
    expect(r.updates.time).toBe('03:00')
  })

  it('"לא, זה ב-15:30" → 15:30', () => {
    const r = parseCorrection('לא, זה ב-15:30', baseDraft, TODAY)
    expect(r.kind).toBe('update')
    expect(r.updates.time).toBe('15:30')
  })

  it('inherits AM if current draft was AM and correction is ambiguous', () => {
    const am = { ...baseDraft, time: '08:00' }
    const r = parseCorrection('לא, בשלוש', am, TODAY)
    expect(r.kind).toBe('update')
    expect(r.updates.time).toBe('03:00')
  })
})

describe('parseCorrection — title correction', () => {
  it('"התכוונתי לרופא" replaces title', () => {
    const r = parseCorrection('התכוונתי לרופא', baseDraft, TODAY)
    expect(r.kind).toBe('update')
    expect(r.updates.title).toBe('רופא')
  })

  it('"לא, זה לא תופרת, זה רופא" replaces title', () => {
    const r = parseCorrection('לא, זה לא תופרת, זה רופא', baseDraft, TODAY)
    expect(r.kind).toBe('update')
    expect(r.updates.title).toBe('רופא')
  })
})

describe('parseCorrection — location correction', () => {
  it('"זה בכפר סבא" updates location', () => {
    const r = parseCorrection('זה בכפר סבא', baseDraft, TODAY)
    expect(r.kind).toBe('update')
    expect(r.updates.location).toBe('כפר סבא')
  })

  it('"לא, זה ברחוב הרצל 22" updates street', () => {
    const r = parseCorrection('לא, זה ברחוב הרצל 22', baseDraft, TODAY)
    expect(r.kind).toBe('update')
    expect(r.updates.location).toContain('רחוב הרצל 22')
  })
})

describe('parseCorrection — kind classification', () => {
  it('bare "לא" with no field becomes cancel', () => {
    const r = parseCorrection('לא', baseDraft, TODAY)
    expect(r.kind).toBe('cancel')
  })

  it('"כן" with no field becomes confirm', () => {
    const r = parseCorrection('כן', baseDraft, TODAY)
    expect(r.kind).toBe('confirm')
  })

  it('"לקבוע" alone is confirm', () => {
    const r = parseCorrection('לקבוע', baseDraft, TODAY)
    expect(r.kind).toBe('confirm')
  })

  it('totally unrelated text is unrelated', () => {
    const r = parseCorrection('מה השעה עכשיו', baseDraft, TODAY)
    expect(r.kind).toBe('unrelated')
  })
})

describe('parseCorrection — vague rejection asks for clarification (does not cancel)', () => {
  it('"זה לא נכון" with no field → clarify', () => {
    const r = parseCorrection('זה לא נכון', baseDraft, TODAY)
    expect(r.kind).toBe('clarify')
    expect(r.updates).toEqual({})
  })

  it('"לא נכון" alone → clarify', () => {
    const r = parseCorrection('לא נכון', baseDraft, TODAY)
    expect(r.kind).toBe('clarify')
  })

  it('"לא ככה" → clarify (not cancel, not unrelated)', () => {
    const r = parseCorrection('לא ככה', baseDraft, TODAY)
    expect(r.kind).toBe('clarify')
  })

  it('"זה לא נכון, זה בשלוש" still updates time (specific correction wins)', () => {
    const r = parseCorrection('זה לא נכון, זה בשלוש', baseDraft, TODAY)
    expect(r.kind).toBe('update')
    expect(r.updates.time).toBe('15:00')
  })
})

describe('parseCorrection — "זה לא A, זה B" pair pattern', () => {
  it('"זה לא ב-2:14, זה ב-3" → time = 15:00 (PM inherited from PM draft)', () => {
    const r = parseCorrection('זה לא ב-2:14, זה ב-3', baseDraft, TODAY)
    expect(r.kind).toBe('update')
    expect(r.updates.time).toBe('15:00')
  })

  it('"זה אצל אופיר בכפר סבא" → updates title and location together', () => {
    const r = parseCorrection('זה אצל אופיר בכפר סבא', baseDraft, TODAY)
    expect(r.kind).toBe('update')
    expect(r.updates.title).toBe('אצל אופיר')
    expect(r.updates.location).toBe('כפר סבא')
  })

  it('"לא ב-10, ב-12" replaces hour (numeric, no minutes)', () => {
    const r = parseCorrection('לא ב-10, ב-12', { ...baseDraft, time: '10:00' }, TODAY)
    expect(r.kind).toBe('update')
    expect(r.updates.time).toBe('12:00')
  })
})

describe('applyCorrection', () => {
  it('merges updates without resetting other fields', () => {
    const merged = applyCorrection(baseDraft, { time: '15:00' })
    expect(merged.time).toBe('15:00')
    expect(merged.title).toBe('תור אצל התופרת')
    expect(merged.location).toBe('רחוב קוק 14, הרצליה')
    expect(merged.notes).toBe('חור במכנסיים')
    expect(merged.date).toBe('2026-05-01')
  })

  it('preserves location/notes when only title changes', () => {
    const merged = applyCorrection(baseDraft, { title: 'רופא' })
    expect(merged.title).toBe('רופא')
    expect(merged.location).toBe('רחוב קוק 14, הרצליה')
    expect(merged.notes).toBe('חור במכנסיים')
  })
})
