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

export interface RelationQuery {
  type: RelationType
  /** The person the relation is *of* (the anchor name), verbatim from the text. */
  subject: string
  /** True for the "<name> … של מי" shape (X is the <relation> of whom). */
  reverse: boolean
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
  partner:       ['בעל', 'בעלה', 'אישה', 'אשה', 'אשת', 'אשתו', 'אשתה', 'בן זוג', 'בת זוג', 'בן הזוג', 'בת הזוג', 'פרטנר', 'פרטנרית'],
  ex_spouse:     ['גרוש', 'גרושה', 'גרושתו', 'גרושתה'],
  aunt:          ['דודה', 'דודתו', 'דודתה', 'דודות'],
  uncle:         ['דוד', 'דודו', 'דודים'],
  son_in_law:    ['חתן', 'חתנו', 'חתנה', 'חתנים'],
  daughter_in_law: ['כלה', 'כלת', 'כלתו', 'כלתה', 'כלות'],
  brother_in_law: ['גיס', 'גיסו', 'גיסים'],
  sister_in_law: ['גיסה', 'גיסתו', 'גיסתה', 'גיסות'],
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

/** Normalize a bare relation term/phrase to its canonical type, or null. */
export function normalizeRelationTerm(rawTerm: string): RelationType | null {
  const t = rawTerm.trim().replace(/\s+/g, ' ')
  if (!t) return null
  return FORM_TO_TYPE.get(t) ?? null
}

// A Hebrew term phrase is 1–2 Hebrew words (covers analytic "בן הזוג").
const TERM = '([\\u05d0-\\u05ea]+(?:\\s+[\\u05d0-\\u05ea]+)?)'
const NAME = '([\\u05d0-\\u05ea]+)'
// Optional interrogative / copula lead-in before the term.
const LEAD = '(?:מי\\s+)?(?:זאת\\s+|זה\\s+|הוא\\s+|היא\\s+)?'

// Forward: "(מי) <term> של <name>"  — name must not be the interrogative מי.
const FORWARD = new RegExp(`${LEAD}${TERM}\\s+של\\s+(?!מי(?![\\u05d0-\\u05ea]))${NAME}`, 'u')
// Reverse: "<name> (הוא/היא) <term> של מי"  — X is the <term> of whom.
const REVERSE = new RegExp(`${NAME}\\s+(?:הוא\\s+|היא\\s+)?${TERM}\\s+של\\s+מי`, 'u')

/**
 * Parse a Hebrew relational question into { type, subject, reverse }, or null if
 * it is not one. The single entry point every path should call before deciding
 * a relation phrase is "unrecognised" and punting to the LLM.
 */
export function parseRelationQuery(text: string): RelationQuery | null {
  const t = text.trim().replace(/[?？!.]+$/g, '')

  // Reverse first: "<name> ... <term> של מי" (so "של מי" is never read as a name).
  const rev = REVERSE.exec(t)
  if (rev) {
    const type = normalizeRelationTerm(rev[2]!)
    if (type) return { type, subject: rev[1]!.trim(), reverse: true }
  }

  const fwd = FORWARD.exec(t)
  if (fwd) {
    const type = normalizeRelationTerm(fwd[1]!)
    if (type) return { type, subject: fwd[2]!.trim(), reverse: false }
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
