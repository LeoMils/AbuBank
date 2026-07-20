/*
 * Person-phrase resolver — "החתן של רפי" → the REAL person (גלעד).
 * ════════════════════════════════════════════════════════════════
 * When a calendar create/search names a person by a RELATION PHRASE ("פגישה עם
 * החתן של רפי"), the meeting must bind to the resolved person (גלעד), not the
 * literal phrase (Leo device failure #1).
 *
 * SINGLE SOURCE: this now delegates to the ONE morphology seam
 * (familyReasoning.resolveSinglePerson → relationMorphology + the family graph).
 * There is no second inflection table here — blood AND in-laws (חתן/כלה/חם/חמות/
 * גיס/גיסה) are covered by the seam. Returns null when it is not a relation
 * phrase, the target is unknown, or the result is ambiguous (never guesses).
 *
 * Pure: no LLM, no fetch.
 */
import { resolveSinglePerson } from './familyReasoning'

/**
 * Resolve "ה?<rel> של <name>" to the single real person's Hebrew name, or null
 * when it is not a relation phrase / the target is unknown / the result is
 * ambiguous (more than one person — we do NOT guess which).
 */
export function resolvePersonPhrase(phrase: string): string | null {
  return resolveSinglePerson((phrase ?? '').trim())?.person ?? null
}
