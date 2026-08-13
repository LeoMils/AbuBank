/*
 * familyPortrait.test.ts — Phase 3 proof: Abu HOLDS the family in her head (generated FROM data).
 * The decisive test the brief demands: adding a person is a DATA edit only, and they appear in
 * the assembled portrait. Plus warmth/tiering/coverage and no clerk-like artefacts.
 */
import { describe, it, expect } from 'vitest'
import { buildFamilyPortrait } from './familyPortrait'

describe('the companion portrait — generated from data, warm, complete', () => {
  const p = buildFamilyPortrait()

  it('holds the closest circle in warmth (not a bare list)', () => {
    expect(p).toContain('מור')
    expect(p).toContain('לאו')
    expect(p).toContain('אופיר')
    expect(p).toContain('יד ימינה של מרטיטה') // Leo's warm note is present, not just his name
    expect(p).toContain('מתוקה אמיתית')        // Ofir's warm note
  })

  it('answers "who are my friends" — the friend circle is present and warm', () => {
    expect(p).toContain('# החברים של מרתה')
    for (const f of ['סוזי רז', 'לידיה אומנסקי', 'נוח אומנסקי', 'שושנה', 'אולגה קאני']) {
      expect(p, `friend ${f} missing`).toContain(f)
    }
    expect(p).toContain('דיור מוגן') // Susi's story, in warmth
  })

  it('holds the extended family so nobody is "unrelated" (Papi side + Martita side)', () => {
    for (const person of ['דורה', 'יעקב', 'לואיס', 'בובי', 'חורחה', 'רוסיטה', 'טאבלה']) {
      expect(p, `extended ${person} missing`).toContain(person)
    }
  })

  it('holds the life history as story', () => {
    expect(p).toContain('Casa Milstein')
    expect(p).toContain('מנדוסה')
    expect(p).toContain('1977')
    expect(p).toContain('אולפן בן יהודה')
  })

  it('owns the shape of what is unknown (never invent)', () => {
    expect(p).toContain('מה עדיין לא ידוע')
  })

  it('is clean prose — no double-period / empty-paren artefacts', () => {
    expect(p).not.toMatch(/\.\./)
    expect(p).not.toMatch(/\(\s*\)/)
    expect(p).not.toMatch(/\s\)/)
  })

  it('fits in her head with headroom (well under the 60k instructions guard)', () => {
    expect(p.length).toBeGreaterThan(4000)   // rich, not a stub
    expect(p.length).toBeLessThan(30000)      // comfortably under the cap, with growth room
  })

  it('ADDING A PERSON IS A DATA EDIT ONLY — a new person appears in the assembled portrait', () => {
    const base = { family: { extended_family: [
      { hebrew_name: 'טסט־בן־אדם', canonical_name: 'TestPerson', relationship_hebrew: 'בן דוד רחוק של מרתה', notes: 'נוסף רק לבדיקה — מופיע דרך הגנרטור, לא ביד.' },
    ] } }
    const out = buildFamilyPortrait(base, { history: [] })
    expect(out).toContain('טסט־בן־אדם')
    expect(out).toContain('בן דוד רחוק של מרתה')
  })
})
