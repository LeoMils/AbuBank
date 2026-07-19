/*
 * תעודת המשפחה — pure logic behind the screen.
 * Parse Leo's pasted free text into proposed facts (one per line) via the SAME extractChange
 * the conversation uses, and commit each on tap through THE LAWS gate (LedgerService.writeFact).
 * Reuses familyLaws/ledgerService/conversationIntake — no parallel path.
 */
import { extractChange } from '../../truth/conversationIntake'
import { describeChange, type Change } from '../../truth/familyLaws'
import type { LedgerService } from '../../truth/ledgerService'

export interface Proposal { raw: string; change: Change | null; label: string }

/** One proposal per non-empty line. A leading "תזכרי ש…" is stripped so a pasted sentence
 *  and a spoken sentence parse identically. Unrecognized lines are surfaced, never silently dropped. */
export function parseFreeText(text: string): Proposal[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((raw) => {
    const fact = raw.replace(/^(?:תזכרי|זכרי|תרשמי|רשמי)\s+ש/u, '')
    const change = extractChange(fact)
    return { raw, change, label: change ? describeChange({ ...change, ...(change.op === 'addFact' ? { fact: { ...change.fact, at: 0 } } : {}) }) : `לא זוהתה עובדה — ${raw}` }
  })
}

export interface CommitResult { accepted: boolean; line: string }
/** Commit one proposed fact through THE LAWS gate. A contradiction is refused with its reason. */
export function commitProposal(svc: LedgerService, change: Change, nowMs: number): CommitResult {
  const stamped: Change = change.op === 'addFact' ? { ...change, fact: { ...change.fact, at: nowMs, source: 'upload' } } : change
  const o = svc.writeFact(stamped, nowMs, 'upload')
  return o.ok ? { accepted: true, line: `רשמתי: ${o.line}` } : { accepted: false, line: `לא רשמתי — ${o.reason}` }
}
