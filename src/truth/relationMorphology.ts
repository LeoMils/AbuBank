/*
 * RELATION MORPHOLOGY — the ONE normalization seam for Hebrew relation terms.
 * ════════════════════════════════════════════════════════════════════════════
 * Intake-rebuild P2. Every path that reads a *relation phrase* (who-is, create,
 * search, title, ledger) should normalize the term through THIS module instead
 * of hand-rolling its own inflection regexes. The systematic Hebrew inflection
 * space is table-driven so it is complete and auditable, not phrase-by-phrase:
 *
 *   • bare            אמא / אבא / בת / אח / כלה / חתן / גיס
 *   • definite ה־     האמא / הבת / הכלה / החתן
 *   • construct       אשת־ / כלת־ / בן־זוג
 *   • possessive      אמו / אמה / אביו / בתו / בתה / בעלה / אשתו / כלתו / חתנו / גיסתה
 *   • analytic        בן הזוג / בת הזוג (term + definite noun)
 *   • plural          ילדים / אחים / אחיות / נכדים / דודות
 *
 * PURE + deterministic. No graph access here (that lives in familyReasoning);
 * this module is linguistics only: term/phrase → canonical RelationType. The
 * canonical type already implies the answer's gender filter, so downstream
 * resolvers stay simple. Adding a dial=" my form" is a one-line table edit and
 * the generative suite (relationMorphology.test.ts) then covers it everywhere.
 */

export type RelationType =
  | 'grandmother' | 'grandfather' | 'grandparent'
  | 'mother' | 'father' | 'parent'
  | 'daughter' | 'son' | 'children'
  | 'sister' | 'brother' | 'siblings'
  | 'grandchildren'
  | 'partner' | 'ex_spouse'
  | 'aunt' | 'uncle'
  | 'son_in_law' | 'daughter_in_law' | 'brother_in_law' | 'sister_in_law'
  | 'father_in_law' | 'mother_in_law'

export interface RelationQuery {
  type: RelationType
  /** The person the relation is *of* (the anchor name), verbatim from the text. */
  subject: string
  /** True for the "<name> … של מי" shape (X is the <relation> of whom). */
  reverse: boolean
  /** The exact matched span ("בת הזוג של מור"), for in-place substitution by callers. */
  match: string
}

/*
 * The morphology table: canonical type → every surface form that denotes it,
 * as it appears immediately before "של" (or standalone in a reverse query).
 * Forms are listed WITHOUT the definite ה prefix; the reverse map adds the
 * ה-prefixed variant automatically. Multi-word analytic/construct forms are
 * allowed (matched as a 1–2 word term phrase by the extractor).
 */
const RELATION_FORMS: Record<RelationType, string[]> = {
  grandmother:   ['סבתא', 'סבתה', 'סבתא רבתא'],
  grandfather:   ['סבא', 'סבא רבא'],
  grandparent:   [],
  mother:        ['אמא', 'אימא', 'אם', 'אמו', 'אמה', 'אימו', 'אימה'],
  father:        ['אבא', 'אב', 'אביו', 'אביה'],
  parent:        ['הורה', 'הורו'],
  daughter:      ['בת', 'בתו', 'בתה'],
  son:           ['בן', 'בנו', 'בנה'],
  children:      ['ילדים', 'בנים', 'ילדות', 'ילדיו', 'ילדיה'],
  sister:        ['אחות', 'אחותו', 'אחותה'],
  brother:       ['אח', 'אחיו', 'אחיה', 'אחי'],
  siblings:      ['אחים', 'אחיות'],
  grandchildren: ['נכד', 'נכדה', 'נכדים', 'נכדות', 'נכדו', 'נכדתו', 'נכדתה', 'נכדיו', 'נכדיה'],
  partner:       ['בעל', 'בעלה', 'אישה', 'אשה', 'אשת', 'אשתו', 'אשתה', 'בן זוג', 'בת זוג', 'בן הזוג', 'בת הזוג', 'פרטנר', 'פרטנרית', 'חבר', 'חברה', 'שותף', 'שותפה'],
  ex_spouse:     ['גרוש', 'גרושה', 'גרושתו', 'גרושתה'],
  aunt:          ['דודה', 'דודתו', 'דודתה', 'דודות'],
  uncle:         ['דוד', 'דודו', 'דודים'],
  son_in_law:    ['חתן', 'חתנו', 'חתנה', 'חתנים'],
  daughter_in_law: ['כלה', 'כלת', 'כלתו', 'כלתה', 'כלות'],
  brother_in_law: ['גיס', 'גיסו', 'גיסים'],
  sister_in_law: ['גיסה', 'גיסתו', 'גיסתה', 'גיסות'],
  father_in_law: ['חם', 'חמי', 'חמיו', 'חמיה'],
  mother_in_law: ['חמות', 'חמותו', 'חמותה'],
}

// NOTE: 'דוד' (uncle) and 'דודה' (aunt) collide with each other only by the
// trailing ה, and 'גיס' vs 'גיסה' likewise. Longer/female forms are inserted
// first so an exact-match lookup prefers the specific form; the extractor uses
// exact phrase equality (no prefix bleed), so 'דוד' never shadows 'דודה'.

/** form (with and without the definite ה) → canonical type. Built once. */
const FORM_TO_TYPE: Map<string, RelationType> = (() => {
  const m = new Map<string, RelationType>()
  const put = (form: string, type: RelationType) => { if (!m.has(form)) m.set(form, type) }
  for (const [type, forms] of Object.entries(RELATION_FORMS) as [RelationType, string[]][]) {
    for (const f of forms) {
      const clean = f.trim().replace(/\s+/g, ' ')
      if (!clean) continue
      put(clean, type)
      // definite variant: prefix ה on the first word only (הבת, הדודה, ה + "בן זוג" → "הבן זוג")
      put('ה' + clean, type)
    }
  }
  return m
})()

/*
 * Phonetic fold for garble-tolerance (P3): collapse the Hebrew near-homophones
 * an STT engine confuses so a single-character slip still resolves. Gated to
 * terms of length ≥ 3 so short function words (e.g. "עם") never fold onto a
 * relation term. Built once, in parallel with the exact map.
 */
const PHON_FOLD: Record<string, string> = { 'ק': 'כ', 'ך': 'כ', 'ח': 'כ', 'ט': 'ת', 'ע': 'א', 'ב': 'ו', 'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ' }
function phoneticKey(word: string): string { return [...word].map((c) => PHON_FOLD[c] ?? c).join('') }

/** phonetic key → type, ONLY where the fold is unambiguous (one type per key). */
const PHON_TO_TYPE: Map<string, RelationType | null> = (() => {
  const m = new Map<string, RelationType | null>()
  for (const [form, type] of FORM_TO_TYPE) {
    if (form.replace(/\s/g, '').length < 3) continue // skip short forms (collision-prone)
    const k = phoneticKey(form)
    if (m.has(k) && m.get(k) !== type) m.set(k, null) // ambiguous fold → refuse
    else if (!m.has(k)) m.set(k, type)
  }
  return m
})()

/** Normalize a bare relation term/phrase to its canonical type, or null.
 *  Exact match first; then a phonetic-fold fallback for single-char STT garble
 *  ("החטן"→son_in_law) — only when the fold is unambiguous. */
export function normalizeRelationTerm(rawTerm: string): RelationType | null {
  const t = rawTerm.trim().replace(/\s+/g, ' ')
  if (!t) return null
  const exact = FORM_TO_TYPE.get(t)
  if (exact) return exact
  if (t.replace(/\s/g, '').length >= 3) {
    const phon = PHON_TO_TYPE.get(phoneticKey(t))
    if (phon) return phon
  }
  return null
}

// A Hebrew term phrase is 1–2 Hebrew words (covers analytic "בן הזוג").
const TERM = '([\\u05d0-\\u05ea]+(?:\\s+[\\u05d0-\\u05ea]+)?)'
const NAME = '([\\u05d0-\\u05ea]+)'
// Optional interrogative / copula lead-in before the term.
const LEAD = '(?:מי\\s+)?(?:זאת\\s+|זה\\s+|הוא\\s+|היא\\s+)?'

// Forward: "(מי) <term> של <name>"  — name must not be the interrogative מי.
// Global so we can skip a leading non-relation "<x> של <y>" (e.g. הכלב של מור)
// and keep scanning for the first phrase whose term is a real relation.
const FORWARD_G = new RegExp(`${LEAD}${TERM}\\s+של\\s+(?!מי(?![\\u05d0-\\u05ea]))${NAME}`, 'gu')
// Reverse: "<name> (הוא/היא) <term> של מי"  — X is the <term> of whom.
const REVERSE_G = new RegExp(`${NAME}\\s+(?:הוא\\s+|היא\\s+)?${TERM}\\s+של\\s+מי`, 'gu')

/**
 * Parse a Hebrew relational question into { type, subject, reverse, match }, or
 * null if it is not one. The single entry point every path should call before
 * deciding a relation phrase is "unrecognised" and punting to the LLM. Scans for
 * the first phrase whose term actually normalizes, so a non-relation "<x> של <y>"
 * earlier in the sentence never shadows a real relation reference.
 */
export function parseRelationQuery(text: string): RelationQuery | null {
  const t = text.trim().replace(/[?？!.]+$/g, '')

  // Reverse first: "<name> ... <term> של מי" (so "של מי" is never read as a name).
  // On a non-normalizing hit, retry from one char after the match START (not the
  // end) so a greedy 2-word capture that swallowed a leading word (e.g. a
  // preposition) never hides a real relation phrase just after it.
  REVERSE_G.lastIndex = 0
  for (let m = REVERSE_G.exec(t); m; m = REVERSE_G.exec(t)) {
    const type = normalizeRelationTerm(m[2]!)
    if (type) return { type, subject: m[1]!.trim(), reverse: true, match: m[0].trim() }
    REVERSE_G.lastIndex = m.index + 1
  }

  FORWARD_G.lastIndex = 0
  for (let m = FORWARD_G.exec(t); m; m = FORWARD_G.exec(t)) {
    const type = normalizeRelationTerm(m[1]!)
    if (type) {
      // Span for substitution: the "<term> של <name>" phrase only (drop any
      // leading interrogative/copula lead so callers replace just the reference).
      const span = `${m[1]!.trim()} של ${m[2]!.trim()}`
      return { type, subject: m[2]!.trim(), reverse: false, match: span }
    }
    FORWARD_G.lastIndex = m.index + 1
  }
  return null
}

/** All canonical relation types that have at least one surface form (for tests). */
export function relationTypesWithForms(): RelationType[] {
  return (Object.keys(RELATION_FORMS) as RelationType[]).filter((t) => RELATION_FORMS[t].length > 0)
}

/** The surface forms for a type (bare, no ה) — used by the generative suite. */
export function surfaceFormsOf(type: RelationType): string[] {
  return [...RELATION_FORMS[type]]
}
