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
// Kinship words we capture — multi-word forms ("בן הזוג") MUST come before
// their single-word prefixes ("בן") so the longer form wins.
// "חבר/חברה" (friend) is intentionally captured so the UI can honestly
// acknowledge the phrase, even though family_data.json holds no friend
// records — the resolver returns `missing` for these (never invented).
const KIND = `בן\\s+הזוג|בת\\s+הזוג|סבתא|סבא|נכדה|נכד|בעלה|בעל|אשתו|אשת|אישה|אחות|אח|אבא|אמא|אב|אם|גרושה|גרוש|בת|בן|חברה|חבר`
// Friend descriptors — recognized for honest "missing" acknowledgement, never
// resolved to a family member.
const FRIEND_KIND = new Set(['חבר', 'חברה'])
// Parent / ex-spouse descriptor sets — resolved from familyGraph
// parentsHe / exSpousesHe respectively. "ה" prefix is handled by the
// REL_DESCRIPTOR captures it via the [בלמהשכו]? prefix class.
const PARENT_MALE = new Set(['אבא', 'אב'])
const PARENT_FEMALE = new Set(['אמא', 'אם'])
const EX_SPOUSE_MALE = new Set(['גרוש'])
const EX_SPOUSE_FEMALE = new Set(['גרושה'])
// "עם <relationship phrase>" — preferred when present.
const REL_AFTER_WITH = new RegExp(`עם\\s+(ה?(?:${KIND})\\s+של\\s+[֐-׿']+)`)
// Same kinship-of-Name pattern ANYWHERE, allowing the Hebrew prepositional
// prefix that attaches directly to the kinship word (ב/ל/מ/ה/ש/כ/ו) — covers
// "תזכירי לי להתקשר לבעל של אופיר…". Lookbehind keeps us out of the middle of
// a Hebrew word.
const REL_ANYWHERE = new RegExp(`(?<![֐-׿])([בלמהשכו]?(?:${KIND})\\s+של\\s+[֐-׿']+)`)
// "עם <single name>"
const NAME_AFTER_WITH = /עם\s+([֐-׿']+)/
// A standalone relationship descriptor (already extracted), with optional
// Hebrew prepositional prefix.
const REL_DESCRIPTOR = new RegExp(`^[בלמהשכו]?(${KIND})\\s+של\\s+([֐-׿']+)$`)

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
  const any = t.match(REL_ANYWHERE)
  if (any) return any[1]!.trim()
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
    // Friend phrases ("חברה של מור") are recognized but never resolved —
    // family_data.json holds no friend records. UI surfaces a clear
    // "לא מצאתי בוודאות מי…" message and lets the user save as-is.
    if (FRIEND_KIND.has(kind)) return { status: 'missing', phrase }
    const root = findNode(ofName)
    if (!root) return { status: 'missing', phrase }

    const isSpouse = SPOUSE_MALE.has(kind) || SPOUSE_FEMALE.has(kind)
    const isSibling = kind === 'אח' || kind === 'אחות'
    const isParent = PARENT_MALE.has(kind) || PARENT_FEMALE.has(kind)
    const isExSpouse = EX_SPOUSE_MALE.has(kind) || EX_SPOUSE_FEMALE.has(kind)
    const isGrandparent = kind === 'סבא' || kind === 'סבתא'
    const wantGender: 'female' | 'male' =
        isSpouse ? (SPOUSE_MALE.has(kind) ? 'male' : 'female')
      : isParent ? (PARENT_MALE.has(kind) ? 'male' : 'female')
      : isExSpouse ? (EX_SPOUSE_MALE.has(kind) ? 'male' : 'female')
      : isGrandparent ? (kind === 'סבא' ? 'male' : 'female')
      : (kind === 'בת' || kind === 'נכדה' || kind === 'אחות' ? 'female' : 'male')

    let candidateHe: string[]
    if (isSpouse) {
      // Spouse OR partner (married vs. unmarried), read straight from the graph.
      candidateHe = [...root.spousesHe, ...root.partnersHe]
    } else if (isParent) {
      candidateHe = [...root.parentsHe]
    } else if (isExSpouse) {
      candidateHe = [...root.exSpousesHe]
    } else if (isGrandparent) {
      // Grandparent = parent of a parent. Walk up two levels.
      const seen = new Set<string>()
      candidateHe = []
      for (const parentHe of root.parentsHe) {
        const parent = findNode(parentHe)
        if (!parent) continue
        for (const gpHe of parent.parentsHe) {
          if (!seen.has(gpHe)) {
            seen.add(gpHe)
            candidateHe.push(gpHe)
          }
        }
      }
    } else if (kind === 'נכד' || kind === 'נכדה') {
      candidateHe = []
      for (const childHe of root.childrenHe) {
        const child = findNode(childHe)
        if (child) candidateHe.push(...child.childrenHe)
      }
    } else if (isSibling) {
      // Sibling = any child of a parent of `root`, excluding `root` itself.
      const seen = new Set<string>([root.hebrew])
      candidateHe = []
      for (const parentHe of root.parentsHe) {
        const parent = findNode(parentHe)
        if (!parent) continue
        for (const sibHe of parent.childrenHe) {
          if (seen.has(sibHe)) continue
          seen.add(sibHe)
          candidateHe.push(sibHe)
        }
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
