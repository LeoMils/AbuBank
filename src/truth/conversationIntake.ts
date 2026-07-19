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

/** Try to parse a plainly-stated family fact into a gated Change. Returns null if none. */
export function extractChange(text: string): Change | null {
  const t = text.trim()
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
  return null
}

/** Classify how (or whether) an utterance should enter the ledger. */
export function classifyIntake(utterance: string): IntakeResult {
  const t = utterance.trim()
  const explicitM = t.match(/^(?:תזכרי|זכרי|תרשמי|רשמי)\s+ש(.+)$/u)
  if (explicitM) {
    const change = extractChange(explicitM[1]!)
    if (change) return { kind: 'explicit', change, reason: 'explicit remember → write now' }
    return { kind: 'ignore', reason: 'explicit but no parseable family fact' }
  }
  if (VAGUE.test(t)) return { kind: 'ignore', reason: 'vague hint → never writes' }
  const change = extractChange(t)
  if (change) return { kind: 'soft-confirm', change, confirmPrompt: `לרשום שזה נכון? ${describeConfirm(change)} — כן/לא`, reason: 'stated fact → one soft confirmation' }
  return { kind: 'ignore', reason: 'no family fact' }
}

function describeConfirm(c: Change): string {
  switch (c.op) {
    case 'addSpouse': return `${c.a} ו${c.b} נשואים`
    case 'addParent': return `${c.parent} הורה של ${c.child}`
    case 'addSibling': return `${c.a} ו${c.b} אחים`
    case 'setBirthdate': return `${c.id} נולד/ה ב-${c.birthdate}`
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
