import { describe, it, expect } from 'vitest'
import { enforceCompanion, findBannedPhrase, BANNED_PHRASES } from './companionComposer'
import { planCompanionTurn } from './companionPlanner'

const plan = (s: string) => planCompanionTurn(s)

describe('companionComposer — banned register guard', () => {
  it('strips database-style prefix but keeps the fact', () => {
    const out = enforceCompanion('על פי הנתונים, יש לך רופא מחר בארבע.', plan('מה יש לי מחר'))
    expect(out).toContain('רופא')
    expect(findBannedPhrase(out)).toBeNull()
  })

  it('removes customer-support and AI self-reference phrases', () => {
    for (const banned of ['אשמח לעזור', 'איך אפשר לעזור', 'אני בינה מלאכותית', 'שאלה מצוינת', 'כל הכבוד', 'אני כאן אם תצטרכי']) {
      const out = enforceCompanion(`${banned}. מור היא הבת שלך.`, plan('מי זאת מור'))
      expect(findBannedPhrase(out)).toBeNull()
      expect(out).toContain('מור')
    }
  })

  it('removes English assistant-isms', () => {
    const out = enforceCompanion('As an AI, I would be happy to help. Mor is your daughter.', plan('who is Mor'))
    expect(findBannedPhrase(out)).toBeNull()
    expect(out.toLowerCase()).toContain('mor')
  })

  it('a response that was ONLY banned filler falls back to a companion line, never empty/banned', () => {
    const out = enforceCompanion('אשמח לעזור! איך אפשר לעזור?', plan('משעמם לי'))
    expect(out.length).toBeGreaterThan(0)
    expect(findBannedPhrase(out)).toBeNull()
  })

  it('every banned phrase is actually detected', () => {
    for (const p of BANNED_PHRASES) expect(findBannedPhrase(`xx ${p} yy`)).not.toBeNull()
  })

  it('clean companion text passes through unchanged in meaning', () => {
    const clean = 'מור, הבת שלך. גרה בהוד השרון עם יעל.'
    expect(enforceCompanion(clean, plan('מי זאת מור'))).toContain('הבת שלך')
  })
})
