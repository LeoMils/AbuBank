/*
 * CONVERSATION INTAKE — how a spoken/typed fact enters the ledger (Constitution §1).
 * ════════════════════════════════════════════════════════════════════════════════
 * Three doors, no more:
 *   • explicit  — "תזכרי ש…" / "זכרי ש…" → write IMMEDIATELY (through the LAWS gate).
 *   • soft-confirm — a plainly-stated fact ("X היא אשתו של Y") → ONE gentle confirmation
 *     before writing (a pending change + a Hebrew prompt).
 *   • ignore — a vague hint ("אולי", "נראה לי", "כנראה") → NEVER writes.
 * Pure + deterministic. Emits a familyLaws.Change so the write still passes THE LAWS.
 */
import type { Change, Gender } from './familyLaws'

export type IntakeKind = 'explicit' | 'soft-confirm' | 'ignore'
export interface IntakeResult { kind: IntakeKind; change?: Change; confirmPrompt?: string; reason: string }

const VAGUE = /(?:אולי|נראה\s+לי|כנראה|אני\s+חושבת|בערך|לא\s+בטוחה|נדמה\s+לי|יכול\s+להיות|אם\s+אני\s+לא\s+טועה)/u
const N = '([א-ת]{2,})' // a Hebrew name token

/** Resolves a relation phrase inside text to a single real person (span→name).
 *  Injected so this pure `truth/` module stays decoupled from the family graph
 *  (which lives in the AbuAI layer). See familyReasoning.resolveSinglePerson. */
export type PersonResolver = (text: string) => { span: string; person: string } | null

/** Try to parse a plainly-stated family fact into a gated Change. Returns null if none. */
export function extractChange(text: string, resolvePerson?: PersonResolver): Change | null {
  let t = text.trim()
  // Route a relation-phrase SUBJECT through the ONE person-reference seam so a
  // fact stated about "הבת של מור" is stored about the resolved person (אופיר).
  // Deterministic + graph-derived: it can only map a phrase to a real KNOWN
  // person, never fabricate one; the LAWS gate still runs on the resulting Change.
  if (resolvePerson) { const ref = resolvePerson(t); if (ref) t = t.replace(ref.span, ref.person) }
  // First-person ("אני אוהבת יין") is Martita's OWN preference — not a person chapter fact;
  // leave it to the existing preference-memory path.
  if (/^(?:אני|אנחנו|אנו)(?![א-ת])/u.test(t)) return null
  // spouse
  let m = t.match(new RegExp(`${N}\\s+(?:היא|הוא)?\\s*(?:אשתו|בעלה|אשת|בעל)\\s+של\\s+${N}`, 'u'))
  if (m) return { op: 'addSpouse', a: m[1]!, b: m[2]! }
  m = t.match(new RegExp(`${N}\\s+(?:ו|עם)\\s*${N}\\s+נשואים`, 'u'))
  if (m) return { op: 'addSpouse', a: m[1]!, b: m[2]! }
  m = t.match(new RegExp(`${N}\\s+נשו(?:י|אה)\\s+ל${N}`, 'u'))
  if (m) return { op: 'addSpouse', a: m[1]!, b: m[2]! }
  // parent: "<child> (ה)בן/בת של <parent>"
  m = t.match(new RegExp(`${N}\\s+ה?(?:בן|בת)\\s+של\\s+${N}`, 'u'))
  if (m) return { op: 'addParent', child: m[1]!, parent: m[2]! }
  // parent: "<parent> (ה)אבא/אמא של <child>"
  m = t.match(new RegExp(`${N}\\s+ה?(?:אבא|אמא|אב|אם)\\s+של\\s+${N}`, 'u'))
  if (m) return { op: 'addParent', child: m[2]!, parent: m[1]! }
  // sibling
  m = t.match(new RegExp(`${N}\\s+ה?(?:אח|אחות)\\s+של\\s+${N}`, 'u'))
  if (m) return { op: 'addSibling', a: m[1]!, b: m[2]! }
  // birthdate: "<name> נולד/ה ב-YYYY-MM-DD" or "בתאריך …"
  m = t.match(new RegExp(`${N}\\s+נולד[הת]?\\s+ב?-?\\s*(\\d{4}-\\d{2}-\\d{2}|\\d{2}-\\d{2})`, 'u'))
  if (m) return { op: 'setBirthdate', id: m[1]!, birthdate: m[2]! }
  // ── FULL-PERSON CHAPTER facts. Medical/health is intentionally NOT extracted
  //    (privacy: never store medical). residence / work / education / hobby / event /
  //    preference each get a labelled kind; anything else about a person is caught by
  //    the generic-story fallback in the EXPLICIT path (classifyIntake), so a stated
  //    fact is never lost. ──
  m = t.match(new RegExp(`${N}\\s+גר[הת]?\\s+ב(.+)$`, 'u'))
  if (m) return { op: 'addFact', id: m[1]!, fact: { kind: 'residence', value: m[2]!.trim(), source: 'conversation', at: 0 } }
  m = t.match(new RegExp(`${N}\\s+עובד[הת]?\\s+ב(.+)$`, 'u'))
  if (m) return { op: 'addFact', id: m[1]!, fact: { kind: 'work', value: m[2]!.trim(), source: 'conversation', at: 0 } }
  m = t.match(new RegExp(`${N}\\s+אוהב[הת]?\\s+(?:את\\s+)?(.+)$`, 'u'))
  if (m) return { op: 'addFact', id: m[1]!, fact: { kind: 'preference', value: m[2]!.trim(), source: 'conversation', at: 0 } }
  return null
}

const FIRST_PERSON = /^(?:אני|אנחנו|אנו)(?![א-ת])/u
// Privacy: never store medical/financial/phone detail — not even on an explicit remember.
const SENSITIVE = /(?:חול[הים]|מחל[הת]|סוכרת|סרטן|תרופ|כאב|רופא|בית\s+חולים|ניתוח|אבחנ|דיכאון|לחץ\s+דם|כסף|שקל|משכורת|חשבון\s+בנק|אשראי|טלפון|0\d{1,2}-?\d{7})/u

/** Verifies a bare name is a real FAMILY member. Injected so `truth/` stays graph-free. */
export type KnownPersonCheck = (name: string) => boolean

/**
 * The EXPLICIT-remember extractor — wider than the shared soft-confirm `extractChange`.
 * Only reached from the "תזכרי ש…" path, so widening here can never turn a conversational
 * statement into a soft-confirm (the shared path is untouched). Chapter facts are about a
 * FAMILY MEMBER: the subject must resolve to a known person (via a relation phrase OR the
 * injected name check) — otherwise it is Martita's OWN memory (dog, wine, "שלי…") and is
 * left to personal-memory (returns null → classifyIntake 'ignore'). First-person, medical,
 * and financial are always declined.
 */
export function extractExplicitFact(text: string, resolvePerson?: PersonResolver, isKnownPerson?: KnownPersonCheck): Change | null {
  const specific = extractChange(text, resolvePerson)
  if (specific) return specific
  if (FIRST_PERSON.test(text.trim()) || SENSITIVE.test(text)) return null

  let t = text.trim()
  let resolvedByRelation = false
  if (resolvePerson) { const ref = resolvePerson(t); if (ref) { t = t.replace(ref.span, ref.person); resolvedByRelation = true } }
  // The subject must be a KNOWN family person — else this is not a person chapter fact.
  const subject = t.match(new RegExp(`^ה?${N}`, 'u'))?.[1]
  if (!resolvedByRelation && !(subject && isKnownPerson?.(subject))) return null

  let m = t.match(new RegExp(`${N}\\s+(?:למד[הת]?|לומד[הת]?|סיים[הת]?\\s+תואר)\\s+(?:את\\s+)?(.+)$`, 'u'))
  if (m) return { op: 'addFact', id: m[1]!, fact: { kind: 'education', value: m[2]!.trim(), source: 'conversation', at: 0 } }
  m = t.match(new RegExp(`${N}\\s+(?:מנג[נן][הת]?|מצייר[הת]?|רוקד[הת]?|אוס[פף][הת]?|משחק[הת]?)\\s+(?:את\\s+|ב)?(.+)$`, 'u'))
  if (m) return { op: 'addFact', id: m[1]!, fact: { kind: 'hobby', value: m[2]!.trim(), source: 'conversation', at: 0 } }
  m = t.match(new RegExp(`${N}\\s+(?:התחתן|התחתנה|התארס[הת]?|טס[הת]?\\s+ל|טייל[הת]?\\s+ב)\\s*(.+)$`, 'u'))
  if (m) return { op: 'addFact', id: m[1]!, fact: { kind: 'event', value: m[2]!.trim(), source: 'conversation', at: 0 } }
  // Generic catch-all: store the whole statement as a STORY for the (known) person.
  const gm = t.match(new RegExp(`^ה?${N}\\s+(.+)$`, 'u'))
  if (gm) return { op: 'addFact', id: gm[1]!, fact: { kind: 'story', value: text.trim(), source: 'conversation', at: 0 } }
  return null
}

/** Classify how (or whether) an utterance should enter the ledger. */
export function classifyIntake(utterance: string, resolvePerson?: PersonResolver, isKnownPerson?: KnownPersonCheck): IntakeResult {
  const t = utterance.trim()
  const explicitM = t.match(/^(?:תזכרי|זכרי|תרשמי|רשמי)\s+ש(.+)$/u)
  if (explicitM) {
    // Explicit-remember covers ALL chapter kinds via the wider explicit extractor
    // (specific labels + generic story fallback) — so "תזכרי ש…" about a known family
    // person is NEVER answered "can't remember". The shared soft-confirm `extractChange`
    // is untouched, and Martita's OWN memories fall through to personal-memory.
    const change = extractExplicitFact(explicitM[1]!, resolvePerson, isKnownPerson)
    if (change) return { kind: 'explicit', change, reason: 'explicit remember → write now' }
    return { kind: 'ignore', reason: 'explicit but no parseable family fact' }
  }
  if (VAGUE.test(t)) return { kind: 'ignore', reason: 'vague hint → never writes' }
  const change = extractChange(t, resolvePerson)
  if (change) return { kind: 'soft-confirm', change, confirmPrompt: `לרשום שזה נכון? ${describeConfirm(change)} — כן/לא`, reason: 'stated fact → one soft confirmation' }
  return { kind: 'ignore', reason: 'no family fact' }
}

function describeConfirm(c: Change): string {
  switch (c.op) {
    case 'addSpouse': return `${c.a} ו${c.b} נשואים`
    case 'addParent': return `${c.parent} הורה של ${c.child}`
    case 'addSibling': return `${c.a} ו${c.b} אחים`
    case 'setBirthdate': return `${c.id} נולד/ה ב-${c.birthdate}`
    case 'addFact': return `${c.id}: ${c.fact.value}`
    default: return ''
  }
}

/** Birthdays → calendar (§3): a birthdate fact proposes a YEARLY calendar entry on approval. */
export interface ProposedEvent { title: string; monthDay: string; recurring: 'yearly'; source: 'ledger-birthday' }
export function proposeBirthdayEvent(name: string, birthdate: string): ProposedEvent {
  const monthDay = birthdate.length === 10 ? birthdate.slice(5) : birthdate // YYYY-MM-DD → MM-DD
  return { title: `יום הולדת של ${name}`, monthDay, recurring: 'yearly', source: 'ledger-birthday' }
}

export type { Gender }
