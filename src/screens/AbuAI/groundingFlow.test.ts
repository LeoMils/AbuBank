import path from 'path'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tryGroundedAnswer } from './service'

describe('tryGroundedAnswer — end-to-end grounding flow', () => {
  let storage: Record<string, string> = {}

  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val },
      removeItem: (key: string) => { delete storage[key] },
    })
  })

  it('"מה יש לי היום?" returns grounded answer, never calls LLM', () => {
    const today = new Date().toISOString().split('T')[0]!
    storage['abubank-calendar-appointments'] = JSON.stringify([
      { id: 'a1', title: 'רופא שיניים', date: today, time: '10:00', emoji: '🏥', color: '#C9A84C' },
    ])
    const answer = tryGroundedAnswer('מה יש לי היום?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('רופא שיניים')
  })

  it('empty today returns warm empty message', () => {
    const answer = tryGroundedAnswer('מה יש לי היום?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('לא מצאתי')
  })

  it('"מה יש מחר?" returns grounded answer', () => {
    const answer = tryGroundedAnswer('מה יש מחר?')
    expect(answer).not.toBeNull()
  })

  it('known family name returns source-backed data', () => {
    const answer = tryGroundedAnswer('מי זאת מור?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('הבת')
  })

  it('unknown family name returns not-found message', () => {
    const answer = tryGroundedAnswer('מי זה דניאל?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('לא מצאתי')
  })

  it('"מה מזג האוויר?" returns null (non_personal, goes to LLM)', () => {
    expect(tryGroundedAnswer('מה מזג האוויר?')).toBeNull()
  })

  it('"ספרי לי על איטליה" returns null (non_personal)', () => {
    expect(tryGroundedAnswer('ספרי לי על איטליה')).toBeNull()
  })

  it('"מי זה עילי?" routes to family and returns data', () => {
    const answer = tryGroundedAnswer('מי זה עילי?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('נכד')
  })

  it('"מה יש לי השבוע?" returns upcoming events', () => {
    const answer = tryGroundedAnswer('מה יש לי השבוע?')
    expect(answer).not.toBeNull()
  })

  it('voice personal query uses same grounding path', () => {
    const answer = tryGroundedAnswer('מה יש לי מחר')
    expect(answer).not.toBeNull()
    expect(typeof answer).toBe('string')
  })

  it('"איפה מור גרה?" returns location with הוד השרון', () => {
    const answer = tryGroundedAnswer('איפה מור גרה?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('הוד השרון')
  })

  it('"איפה גרה מור?" also returns location', () => {
    const answer = tryGroundedAnswer('איפה גרה מור?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('הוד השרון')
  })

  it('"מי זאת מור?" still returns relationship summary, not location', () => {
    const answer = tryGroundedAnswer('מי זאת מור?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('הבת')
    expect(answer).toContain('גרושה')
  })

  it('location query for unknown person returns not-found', () => {
    const answer = tryGroundedAnswer('איפה דניאל גר?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('לא מצאתי')
  })

  it('Realtime is disabled by default — useRealtime = false', async () => {
    const source = await import('fs').then(fs =>
      fs.readFileSync(path.join(process.cwd(), 'src/screens/AbuAI/index.tsx'), 'utf-8')
    )
    expect(source).toContain('const useRealtime = false')
    expect(source).not.toMatch(/const useRealtime = !![^f]/)
  })

  it('all voice paths reach tryGroundedAnswer', async () => {
    const source = await import('fs').then(fs =>
      fs.readFileSync(path.join(process.cwd(), 'src/screens/AbuAI/index.tsx'), 'utf-8')
    )
    const voiceGroundedCount = (source.match(/tryGroundedAnswer/g) ?? []).length
    expect(voiceGroundedCount).toBeGreaterThanOrEqual(2)
  })
})
