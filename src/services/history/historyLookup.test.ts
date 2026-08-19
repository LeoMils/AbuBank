/*
 * historyLookup.test.ts — FIX 3 proof: life history + places are RETRIEVABLE (they had no
 * path before — the facts lived as prose no tool read). Queries the real life_history.json.
 */
import { describe, it, expect } from 'vitest'
import { historyLookup, loadHistory } from './historyLookup'

describe('history_lookup — Martita\'s life history + places now have a retrieval path', () => {
  const asks: Array<[string, RegExp]> = [
    ['ספרי לי על מנדוסה', /Casa Milstein|סן מרטין|מנדוס/],
    ['מה היה עם החנות', /גלנטריה|חנות|מכיר/],
    ['איך עליתם ארצה', /1977|איטליה|אולפן|ישראל/],
    ['ספרי על הילדות שלך', /בואנוס איירס|1945|דורה|יעקב/],
    ['בת ים', /בלפור|ז'בוטינסק|בת ים/],
    ['ארגנטינה', /מנדוס|בואנוס איירס/],
    ['האולפן בנתניה', /נתניה|אולפן|אומנסקי/],
  ]
  for (const [q, re] of asks) {
    it(`"${q}" returns grounded history`, () => {
      const r = historyLookup(q)
      expect(r.status).toBe('ok')
      if (r.status === 'ok') {
        expect(r.entries.length).toBeGreaterThan(0)
        expect(r.entries.some((e) => re.test(e.summary) || re.test(e.topic) || re.test(e.place)), `no entry matched ${re} for "${q}"`).toBe(true)
      }
    })
  }

  it('a broad "tell me your life story" returns several eras', () => {
    const r = historyLookup('ספרי לי את סיפור החיים שלך')
    expect(r.status).toBe('ok')
    if (r.status === 'ok') expect(r.entries.length).toBeGreaterThanOrEqual(4)
  })

  it('an unknown topic is an HONEST not_found — never an invented memory', () => {
    expect(historyLookup('מה עשית אתמול בטיסה למאדים').status).toBe('not_found')
    expect(historyLookup('').status).toBe('not_found')
  })

  it('every history entry is grounded — carries a source and a confidence', () => {
    const all = loadHistory()
    expect(all.length).toBeGreaterThan(0)
    for (const e of all) {
      expect(e.source.length, `${e.id} has no source`).toBeGreaterThan(0)
      expect(['confirmed', 'partial', 'inferred', 'unknown']).toContain(e.confidence)
    }
  })
})
