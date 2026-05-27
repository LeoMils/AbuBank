// Family Context Resolver v1 (calendar-side, READ-ONLY consumer of AbuAI's
// familyGraph). Turns a spoken person phrase into a verified family member —
// or honestly reports ambiguity / absence. NEVER invents a relationship and
// NEVER exposes private fields (returns names only).
//
// Supported:
//   • plain name / alias            → resolved via familyGraph.findNode
//   • "הבת של X" / "הבן של X"        → X's child filtered by gender
//   • "הנכדה של X" / "הנכד של X"     → X's grandchild filtered by gender
//   • 0 matches → missing (preserve the literal phrase, never guess)
//   • >1 match  → ambiguous (caller asks a short clarification)
// Birth-order descriptors ("הגדולה" / "הקטן") are intentionally NOT supported
// (no birth-order data) → they fall through to missing, never guessed.

import { findNode, type GraphNode } from '../AbuAI/familyGraph'

export type FamilyResolveResult =
  | { status: 'resolved'; name: string; phrase: string }
  | { status: 'ambiguous'; candidates: string[]; phrase: string }
  | { status: 'missing'; phrase: string }
  | { status: 'none' }

const STOP_WORDS = /^(הילדים|הרופא|המשפחה|הבית|העבודה|כולם|כולן)$/
// Kinship words we capture after "עם" — multi-word forms ("בן הזוג") MUST come
// before their single-word prefixes ("בן") so the longer form wins.
const KIND = `בן\\s+הזוג|בת\\s+הזוג|נכדה|נכד|בעלה|בעל|אשתו|אשת|אישה|בת|בן`
// "עם <relationship phrase>" — captured intact (e.g. "הבעל של אופיר").
const REL_AFTER_WITH = new RegExp(`עם\\s+(ה?(?:${KIND})\\s+של\\s+[֐-׿']+)`)
// "עם <single name>"
const NAME_AFTER_WITH = /עם\s+([֐-׿']+)/
// A standalone relationship descriptor (already extracted).
const REL_DESCRIPTOR = new RegExp(`^ה?(${KIND})\\s+של\\s+([֐-׿']+)$`)

// Spouse/partner descriptors → gender of the SPOUSE we're looking for.
const SPOUSE_MALE = new Set(['בעל', 'בעלה', 'בן הזוג'])
const SPOUSE_FEMALE = new Set(['אישה', 'אשתו', 'אשת', 'בת הזוג'])

/** Extract the person phrase from a transcript, preferring a full kinship
 *  descriptor ("הבת של מור") over a bare name. Returns null if none. */
export function extractPersonPhrase(text: string | null | undefined): string | null {
  const t = (text ?? '').trim()
  if (!t) return null
  const rel = t.match(REL_AFTER_WITH)
  if (rel) return rel[1]!.trim()
  const name = t.match(NAME_AFTER_WITH)
  if (name && !STOP_WORDS.test(name[1]!)) return name[1]!.trim()
  return null
}

/** True when the phrase is a kinship descriptor (…של…), not a bare name. */
export function isRelationshipDescriptor(phrase: string | null | undefined): boolean {
  return REL_DESCRIPTOR.test((phrase ?? '').trim())
}

export function resolvePersonPhrase(phraseRaw: string | null | undefined): FamilyResolveResult {
  const phrase = (phraseRaw ?? '').trim()
  if (!phrase) return { status: 'none' }

  const desc = phrase.match(REL_DESCRIPTOR)
  if (desc) {
    const kind = desc[1]!.replace(/\s+/g, ' ').trim()  // normalize "בן  הזוג" → "בן הזוג"
    const ofName = desc[2]!
    const root = findNode(ofName)
    if (!root) return { status: 'missing', phrase }

    const isSpouse = SPOUSE_MALE.has(kind) || SPOUSE_FEMALE.has(kind)
    const wantGender: 'female' | 'male' = isSpouse
      ? (SPOUSE_MALE.has(kind) ? 'male' : 'female')
      : (kind === 'בת' || kind === 'נכדה' ? 'female' : 'male')

    let candidateHe: string[]
    if (isSpouse) {
      // Spouse OR partner (married vs. unmarried), read straight from the graph.
      candidateHe = [...root.spousesHe, ...root.partnersHe]
    } else if (kind === 'נכד' || kind === 'נכדה') {
      candidateHe = []
      for (const childHe of root.childrenHe) {
        const child = findNode(childHe)
        if (child) candidateHe.push(...child.childrenHe)
      }
    } else {
      candidateHe = [...root.childrenHe]
    }

    // Keep only nodes whose gender matches with confidence — 'unknown' is
    // excluded so we never guess.
    const names = [...new Set(
      candidateHe
        .map(h => findNode(h))
        .filter((n): n is GraphNode => !!n && n.gender === wantGender)
        .map(n => n.hebrew),
    )]

    if (names.length === 0) return { status: 'missing', phrase }
    if (names.length === 1) return { status: 'resolved', name: names[0]!, phrase }
    return { status: 'ambiguous', candidates: names, phrase }
  }

  // Bare name / alias.
  const node = findNode(phrase)
  if (node) return { status: 'resolved', name: node.hebrew, phrase }

  // A person phrase we could not verify → preserve it, never invent.
  return { status: 'missing', phrase }
}
