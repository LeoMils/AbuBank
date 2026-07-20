/*
 * RETIRED legacy family intake — QUARANTINED for shadow validation only.
 * ════════════════════════════════════════════════════════════════════════════
 * This is the pre-seam pattern intake (a per-form regex list). It is NOT wired
 * into any production path — the morphology seam (familyReasoning.answerFamilyRelation)
 * replaced it. It survives ONLY so the shadow test (intakeShadow) can prove the seam
 * is a strict superset over the corpus (obligation 2: parallel compare + classify
 * divergences; obligation 13: explicit retirement with evidence). Do not re-wire.
 */
import {
  grandparentsOf, unclesAuntsOf, childrenOfPublic, grandchildrenOfPublic,
  childrenByGenderPublic, parentsByGenderPublic, siblingsByGenderPublic,
  partnerOf, exSpouseOf, type FamilyAnswer,
} from './familyReasoning'

const uniq = (a: string[]) => [...new Set(a)]

const REL = [
  { re: /(?:מי\s+)?(?:זאת\s+|זה\s+|היא\s+|הוא\s+)?ה?סבתא(?:\s+רבתא)?\s+של\s+(\S+)/u, rel: 'grandmother', fn: (n: string) => grandparentsOf(n, 'female') },
  { re: /(?:מי\s+)?(?:זה\s+|זאת\s+|הוא\s+|היא\s+)?ה?סבא(?:\s+רבא)?\s+של\s+(\S+)/u, rel: 'grandfather', fn: (n: string) => grandparentsOf(n, 'male') },
  { re: /(?:מי\s+ה?)?דוד(?:ות|ה)\s+של\s+(\S+)/u, rel: 'aunt', fn: (n: string) => unclesAuntsOf(n, 'female') },
  { re: /(?:מי\s+ה?)?דוד(?:ים)?\s+של\s+(\S+)/u, rel: 'uncle', fn: (n: string) => unclesAuntsOf(n, 'male') },
  { re: /(?:ה?ילדים|ה?בנים|ה?ילדות)\s+של\s+(\S+)|מי\s+ה?ילדים\s+של\s+(\S+)/u, rel: 'children', fn: (n: string) => childrenOfPublic(n) },
  { re: /(?:מי\s+ה?)?נכד(?:ים|ות)?\s+של\s+(\S+)/u, rel: 'grandchildren', fn: (n: string) => grandchildrenOfPublic(n) },
  { re: /(?:בן|בת|בני)\s+ה?זוג\s+של\s+(\S+)|ה?בעל[הוהּ]?\s+של\s+(\S+)|ה?איש[הת][הו]?\s+של\s+(\S+)|אשת[הו]\s+של\s+(\S+)|פרטנר.*של\s+(\S+)/u, rel: 'partner', fn: (n: string) => partnerOf(n) },
  { re: /(?:מי\s+)?ה?בת\s+של\s+(\S+)/u, rel: 'daughter', fn: (n: string) => childrenByGenderPublic(n, 'female') },
  { re: /(?:מי\s+)?ה?בן\s+של\s+(\S+)/u, rel: 'son', fn: (n: string) => childrenByGenderPublic(n, 'male') },
  { re: /(?:מי\s+)?ה?(?:אמא|אימא|אם)\s+של\s+(\S+)/u, rel: 'mother', fn: (n: string) => parentsByGenderPublic(n, 'female') },
  { re: /(?:מי\s+)?ה?(?:אבא|אב)\s+של\s+(\S+)/u, rel: 'father', fn: (n: string) => parentsByGenderPublic(n, 'male') },
  { re: /(?:מי\s+ה?)?אח(?:ים|יות)\s+של\s+(\S+)/u, rel: 'siblings', fn: (n: string) => siblingsByGenderPublic(n) },
  { re: /(?:מי\s+ה?)?אחות\s+של\s+(\S+)/u, rel: 'sister', fn: (n: string) => siblingsByGenderPublic(n, 'female') },
  { re: /(?:מי\s+ה?)?אח\s+של\s+(\S+)/u, rel: 'brother', fn: (n: string) => siblingsByGenderPublic(n, 'male') },
  { re: /([֐-׿]+)\s+(?:הוא\s+|היא\s+)?ה?גרוש(?:ה)?\s+של\s+מי/u, rel: 'ex_spouse', fn: (n: string) => exSpouseOf(n) },
  { re: /ממי\s+([֐-׿]+)\s+גרוש(?:ה)?|([֐-׿]+)\s+גרוש(?:ה)?\s+ממי/u, rel: 'ex_spouse', fn: (n: string) => exSpouseOf(n) },
  { re: /(?:מי\s+)?ה?גרוש(?:ה)?\s+של\s+(?!מי(?![֐-׿]))([֐-׿]+)/u, rel: 'ex_spouse', fn: (n: string) => exSpouseOf(n) },
]

/** The OLD pattern resolver — shadow baseline only. */
export function legacyAnswerFamilyRelation(text: string): FamilyAnswer | null {
  const t = text.trim().replace(/[?？]/g, '')
  for (const { re, rel, fn } of REL) {
    const m = re.exec(t)
    if (m) {
      const subject = (m.slice(1).find(Boolean) ?? '').trim()
      if (!subject) continue
      const results = uniq(fn(subject).filter(Boolean))
      return { relation: rel, subject, results, ambiguous: results.length > 1, known: results.length > 0 }
    }
  }
  return null
}
