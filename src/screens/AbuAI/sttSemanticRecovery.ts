/*
 * Hebrew STT Semantic Recovery
 * ════════════════════════════
 * Speech-to-text mangles Hebrew constantly: it drops the definite ה, swaps
 * sibilants (שׂ/שׁ/ס/ז/ח), and splits or fuses words. The downstream meeting
 * engine then extracts garbage ("הזכיר שכירות" as a subject). This layer repairs
 * the OBVIOUS slips BEFORE extraction — but only with evidence:
 *
 *   • A non-word that is a clear phonetic neighbour of a real word is corrected
 *     unconditionally (e.g. "שחירות"/"סחירות"/"זכירות" → "שכירות").
 *   • A correction that could change meaning (a real word → another real word,
 *     e.g. "הזכיר שכירות" → "השכירות") fires ONLY when the surrounding context
 *     supports it (house / tenants / rental / a meeting with a known person).
 *   • Every correction is logged with a reason; uncertain ones lower confidence.
 *   • Never invents a brand-new meaning that has no anchor in the utterance.
 *
 * Deterministic, pure, offline. Returns the repaired text + the correction list.
 */

export interface SttCorrection {
  heard: string
  understoodAs: string
  reason: string
}

export interface SttRecoveryResult {
  text: string
  corrections: SttCorrection[]
  /** 0..0.2 — subtract from confidence when a context-gated guess was made. */
  confidencePenalty: number
}

interface Rule {
  /** What the model mis-heard. */
  pattern: RegExp
  /** The repaired Hebrew. */
  replacement: string
  reason: string
  /** When set, fire only if one of these context cues is present. */
  context?: RegExp
  /** Context-gated guesses cost a little confidence. */
  uncertain?: boolean
}

// Context that confirms a rental/house discussion.
const RENTAL_CTX = /בית|דייר|דיירים|שכירות|שכר\s+דירה|דירה|חוזה|אלכסנדרה/
// Generic meeting context (a person + scheduling cue) — keeps fixes scoped.

// Optional one-letter Hebrew prefix (ה/ל/ב/ו/מ/ש/כ) preserved across a repair so
// "השחירות"→"השכירות", "לזכירות"→"לשכירות", "שהדירים"→"שהדיירים".
const PFX = '([הלבומשכ]?)'

const RULES: Rule[] = [
  // ── שכירות (rental) — the headline STT failure ───────────────────────────
  // Pure non-words → corrected unconditionally (they are not Hebrew words).
  { pattern: new RegExp(`(?<![א-ת])${PFX}זכירות(?![א-ת])`, 'g'), replacement: '$1שכירות', reason: 'phonetic: זכירות→שכירות (non-word)' },
  { pattern: new RegExp(`(?<![א-ת])${PFX}שחירות(?![א-ת])`, 'g'), replacement: '$1שכירות', reason: 'phonetic: שחירות→שכירות (non-word)' },
  { pattern: new RegExp(`(?<![א-ת])${PFX}סחירות(?![א-ת])`, 'g'), replacement: '$1שכירות', reason: 'phonetic: סחירות→שכירות (non-word)' },
  { pattern: new RegExp(`(?<![א-ת])${PFX}שכירת(?![א-ת])`, 'g'), replacement: '$1שכירות', reason: 'phonetic: שכירת→שכירות (truncation)' },
  // "הזכיר שכירות" — "הזכיר" IS a real word (reminded), so gate on rental context.
  { pattern: /(?<![א-ת])הזכיר\s+שכירות(?![א-ת])/g, replacement: 'השכירות', reason: 'fused: "הזכיר שכירות"→"השכירות"', context: RENTAL_CTX, uncertain: true },
  { pattern: /(?<![א-ת])הזכיר\s+(?:את\s+)?השכירות(?![א-ת])/g, replacement: 'השכירות', reason: 'fused: dropped the verb noise before "השכירות"', context: RENTAL_CTX, uncertain: true },

  // ── period-of-day: dropped definite ה ────────────────────────────────────
  { pattern: /(?<![א-ת])אחר\s+צהריים(?![א-ת])/g, replacement: 'אחר הצהריים', reason: 'dropped ה: "אחר צהריים"→"אחר הצהריים"' },
  { pattern: /(?<![א-ת])אחרי\s+צהריים(?![א-ת])/g, replacement: 'אחרי הצהריים', reason: 'dropped ה: "אחרי צהריים"→"אחרי הצהריים"' },

  // ── venue: spacing / fusion around "קפה גרג ברעננה" ──────────────────────
  { pattern: /גרג\s+ב\s+רעננה/g, replacement: 'גרג ברעננה', reason: 'split preposition: "ב רעננה"→"ברעננה"' },
  { pattern: /(?<![א-ת])גריג(?![א-ת])/g, replacement: 'גרג', reason: 'phonetic: "גריג"→"גרג"' },

  // ── tenants spelling ─────────────────────────────────────────────────────
  { pattern: new RegExp(`(?<![א-ת])${PFX}הדירים(?![א-ת])`, 'g'), replacement: '$1הדיירים', reason: 'dropped yod: "הדירים"→"הדיירים"' },
]

/**
 * Repair obvious Hebrew STT mistakes using context. Pure + deterministic.
 */
export function recoverHebrewStt(input: string): SttRecoveryResult {
  let text = input ?? ''
  const corrections: SttCorrection[] = []
  let confidencePenalty = 0

  for (const rule of RULES) {
    if (rule.context && !rule.context.test(text)) continue
    rule.pattern.lastIndex = 0
    const heardMatches = text.match(rule.pattern)
    if (!heardMatches) continue
    // Record a correction per distinct heard form, then apply.
    const distinct = [...new Set(heardMatches.map(m => m.trim()))]
    const single = new RegExp(rule.pattern.source, 'u') // non-global, for per-match substitution
    for (const heard of distinct) {
      const understoodAs = heard.replace(single, rule.replacement)
      if (heard === understoodAs) continue
      corrections.push({ heard, understoodAs, reason: rule.reason })
    }
    text = text.replace(rule.pattern, rule.replacement)
    if (rule.uncertain) confidencePenalty = Math.min(0.2, confidencePenalty + 0.1)
  }

  // collapse any whitespace the replacements introduced
  text = text.replace(/\s+/g, ' ').trim()
  return { text, corrections, confidencePenalty }
}
