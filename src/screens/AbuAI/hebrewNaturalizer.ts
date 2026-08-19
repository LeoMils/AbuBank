/*
 * Hebrew Naturalizer (Phase 11)
 * ═════════════════════════════
 * Repairs the fixable Hebrew slips (wrong conjugation, garbled tokens, doubled
 * words) and flags the unfixable ones so the finalizer can fall back honestly.
 * Runs in the finalizer BEFORE the supervisor, so a grammar slip is fixed while a
 * deeper problem (a hallucinated promise) is still caught downstream.
 *
 * Pure + idempotent. It repairs form, never invents content.
 */
export interface NaturalizeResult { text: string; changed: boolean; stillBroken: boolean }

// Fixable form slips → the natural form.
const REPAIRS: Array<[RegExp, string]> = [
  [/תקבילי/gu, 'תקבעי'],
  [/אחורה\s+צהריים/gu, 'אחר הצהריים'],
  [/\bה\s+צהריים\b/gu, 'הצהריים'],
  // collapse an accidental doubled word ("פגישה פגישה" → "פגישה") — Hebrew-safe
  // lookarounds (no \b, which never matches at a Hebrew boundary).
  [/(?<![א-ת])([א-ת]{2,})\s+\1(?![א-ת])/gu, '$1'],
]

// Broken forms we do NOT silently rewrite (they signal a wrong answer, not a typo):
// a promise-conjugation ("אני תבדוק"), a dangling question fragment.
const STILL_BROKEN = /אני\s+תבדוק|^\s*לך\s+היום\?\s*$|^\s*אני\s+כאן\?\s*$/u

export function naturalizeHebrew(input: string): NaturalizeResult {
  const original = input ?? ''
  let t = original
  for (const [re, to] of REPAIRS) t = t.replace(re, to)
  t = t.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim()
  return { text: t || original.trim(), changed: t !== original, stillBroken: STILL_BROKEN.test(t) }
}

/** True when the text still contains a broken form the naturalizer can't safely fix. */
export function isBrokenHebrew(input: string): boolean {
  return naturalizeHebrew(input).stillBroken
}
