/*
 * AbuCalendar P0.7 — domain correction layer.
 *
 * After transcription, before parser, apply a conservative correction
 * pass that fixes known family name and Israeli place misspellings.
 *
 * Truth Contract:
 *   • Replacements are deterministic. Each rule maps a small set of
 *     known misspellings to exactly one target.
 *   • If a token does not match a rule, it is left untouched. NEVER
 *     fuzzy-correct unknown words.
 *   • Preserve the raw transcript in the trace. The corrected
 *     transcript flows to the parser.
 *   • Every applied correction is reported in `correctionsApplied`
 *     for operator visibility.
 *
 * Pure module — no React, no I/O, no env access.
 */

export interface CorrectionRule {
  /** Misspelling to look for. */
  from: string
  /** Canonical target. */
  to: string
  /** Why this rule exists — surfaces in the trace. */
  reason: string
}

/** Family-name corrections. Only HIGH-confidence close misspellings
 *  observed in real phone QA. Conservative — no fuzzy edit-distance. */
const FAMILY_RULES: CorrectionRule[] = [
  // אופיר variants (Ofir)
  { from: 'אפיר', to: 'אופיר', reason: 'family:Ofir' },
  { from: 'עפיר', to: 'אופיר', reason: 'family:Ofir' },
  { from: 'עופיר', to: 'אופיר', reason: 'family:Ofir' },
  // לאו variants (Leo)
  { from: 'ליאו', to: 'לאו', reason: 'family:Leo' },
  { from: 'לאון', to: 'לאו', reason: 'family:Leo' },
  // מור variants (Mor)
  { from: 'מורי', to: 'מור', reason: 'family:Mor' },
  // רפי variants (Rafi)
  { from: 'רפיי', to: 'רפי', reason: 'family:Rafi' },
  // מרטיטה variants
  { from: 'מרטיתה', to: 'מרטיטה', reason: 'family:Martita' },
  { from: 'מרתיתה', to: 'מרטיטה', reason: 'family:Martita' },
  // אילון variants (Ayalon)
  { from: 'איילון', to: 'אילון', reason: 'family:Ayalon-alias' },
  // עילי variants (Eili)
  { from: 'עילאי', to: 'עילי', reason: 'family:Eili-alias' },
]

/** Place corrections — Israeli cities relevant to Martita / Leo / Mor. */
const PLACE_RULES: CorrectionRule[] = [
  // פתח תקווה
  { from: 'פתח תיקווה', to: 'פתח תקווה', reason: 'place:Petah-Tikva' },
  { from: 'פתח תקוה',   to: 'פתח תקווה', reason: 'place:Petah-Tikva' },
  { from: 'פתח תקבה',   to: 'פתח תקווה', reason: 'place:Petah-Tikva' },
  { from: 'פתח טיקווה', to: 'פתח תקווה', reason: 'place:Petah-Tikva' },
  { from: 'פתח טיקוה',  to: 'פתח תקווה', reason: 'place:Petah-Tikva' },
  // כפר סבא
  { from: 'כפר-סבא', to: 'כפר סבא', reason: 'place:Kfar-Saba' },
  // הוד השרון
  { from: 'הוד-השרון', to: 'הוד השרון', reason: 'place:Hod-HaSharon' },
]

const ALL_RULES = [...FAMILY_RULES, ...PLACE_RULES]

/** Hebrew letters are NOT word characters in JS regex, so `\b` doesn't
 *  fire. We anchor each rule on whitespace / punctuation / start / end
 *  by hand. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const HE_BOUNDARY_BEFORE = `(?<![\\u0590-\\u05FFA-Za-z])`
const HE_BOUNDARY_AFTER  = `(?![\\u0590-\\u05FFA-Za-z])`

function applyRule(text: string, rule: CorrectionRule): { next: string; hit: boolean } {
  // Hebrew prepositional prefixes (ב / ל / מ / ה / ו / ש / כ) attach
  // directly to the next word: "בפתח תקווה", "לפתח תקווה". For
  // MULTI-WORD targets we relax the before-boundary so the rule can
  // fire after such a prefix. For single-token names (family names)
  // we keep the strict boundary to prevent over-correction inside
  // longer Hebrew runs.
  const multiWord = /\s/.test(rule.from)
  const before = multiWord ? '' : HE_BOUNDARY_BEFORE
  const re = new RegExp(before + escapeRe(rule.from) + HE_BOUNDARY_AFTER, 'g')
  let hit = false
  const next = text.replace(re, () => { hit = true; return rule.to })
  return { next, hit }
}

export interface NormalizeResult {
  corrected: string
  rawText: string
  correctionsApplied: Array<{ from: string; to: string; reason: string }>
}

export function normalizeCalendarTranscript(text: string): NormalizeResult {
  const rawText = text
  let working = text
  const applied: Array<{ from: string; to: string; reason: string }> = []
  for (const rule of ALL_RULES) {
    const r = applyRule(working, rule)
    if (r.hit) {
      working = r.next
      applied.push({ from: rule.from, to: rule.to, reason: rule.reason })
    }
  }
  return { corrected: working, rawText, correctionsApplied: applied }
}

/** Read-only access to the rule set so tests can assert coverage. */
export function listCorrectionRules(): ReadonlyArray<CorrectionRule> {
  return ALL_RULES
}
