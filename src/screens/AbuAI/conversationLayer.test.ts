import { describe, it, expect } from 'vitest'
import {
  UPDATE_ACKS,
  CANCEL_RESPONSE,
  UNRELATED_RESPONSE,
  pickUpdateAck,
  shapeCorrectionUpdate,
} from './conversationLayer'

describe('UPDATE_ACKS pool', () => {
  it('contains the seed phrases requested', () => {
    expect(UPDATE_ACKS).toContain('אה, הבנתי —')
    expect(UPDATE_ACKS).toContain('סבבה —')
    expect(UPDATE_ACKS).toContain('רגע, מתקנת —')
  })

  it('every ack ends with a dash so it scans as a header', () => {
    for (const a of UPDATE_ACKS) expect(a.trim().endsWith('—')).toBe(true)
  })

  it('every ack is one short line', () => {
    for (const a of UPDATE_ACKS) {
      expect(a.includes('\n')).toBe(false)
      expect(a.length).toBeLessThanOrEqual(20)
    }
  })
})

describe('pickUpdateAck', () => {
  it('returns a member of UPDATE_ACKS', () => {
    for (let i = 0; i < 20; i++) {
      const r = (i % UPDATE_ACKS.length) / UPDATE_ACKS.length
      expect(UPDATE_ACKS).toContain(pickUpdateAck({ rand: () => r }))
    }
  })

  it('avoids the previous ack when one is given', () => {
    const prev = UPDATE_ACKS[0]!
    for (let i = 0; i < 20; i++) {
      const r = i / 20
      const got = pickUpdateAck({ avoid: prev, rand: () => r })
      expect(got).not.toBe(prev)
      expect(UPDATE_ACKS).toContain(got)
    }
  })

  it('falls back to the full pool when avoid filters everything (defensive)', () => {
    const got = pickUpdateAck({ avoid: 'something not in pool', rand: () => 0 })
    expect(UPDATE_ACKS).toContain(got)
  })
})

describe('shapeCorrectionUpdate', () => {
  it('prepends the ack as its own line above the confirmation', () => {
    const out = shapeCorrectionUpdate('מחר בשלוש —\nתור אצל התופרת.\n\nלקבוע?', 'סבבה —')
    expect(out.startsWith('סבבה —\n')).toBe(true)
    expect(out).toContain('תור אצל התופרת.')
    expect(out.trim().endsWith('לקבוע?')).toBe(true)
  })

  it('does not duplicate the confirmation body', () => {
    const body = 'מחר בעשר —\nרופא.\n\nלקבוע?'
    const out = shapeCorrectionUpdate(body, 'אוקיי —')
    expect(out.match(/לקבוע\?/g)).toHaveLength(1)
  })
})

describe('CANCEL_RESPONSE', () => {
  it('is short, warm, and not robotic', () => {
    expect(CANCEL_RESPONSE).toBe('אוקיי, לא שומרת.')
    expect(CANCEL_RESPONSE.split('\n')).toHaveLength(1)
  })
})

describe('UNRELATED_RESPONSE', () => {
  it('uses two short lines and asks the user to repeat', () => {
    expect(UNRELATED_RESPONSE).toBe('לא בטוחה שהבנתי —\nאפשר להגיד לי שוב?')
    const lines = UNRELATED_RESPONSE.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines.every(l => l.length <= 32)).toBe(true)
  })

  it('does not start with the old robotic phrase', () => {
    expect(UNRELATED_RESPONSE.startsWith('לא הבנתי את התיקון')).toBe(false)
  })
})
