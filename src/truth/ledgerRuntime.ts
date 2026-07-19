/*
 * LEDGER RUNTIME — the thin seam between the AbuAI conversation and the ledger.
 * ═══════════════════════════════════════════════════════════════════════════
 * WRITE: an explicit "תזכרי ש<family fact>" writes through THE LAWS gate.
 * READ:  a "מי <relation> של <name>" the static graph is silent about is answered from
 *        the ledger (a conversation-added fact). Ledger-fills-the-gap — the LAWS gate
 *        already guarantees a ledger fact can never contradict the graph.
 * Constructs a fresh LedgerService per call (state lives in localStorage), so it is
 * stateless here and safe under tests.
 */
import { LedgerService, localLedgerStore } from './ledgerService'
import { classifyIntake } from './conversationIntake'
import type { Change } from './familyLaws'

export function familyLedger(): LedgerService { return new LedgerService(localLedgerStore()) }

/** Commit an already-parsed Change (e.g. a soft-confirmed pending fact) through the gate. */
export function ledgerCommit(change: Change, nowMs: number): LedgerWrite {
  const o = familyLedger().writeFact(change, nowMs, 'conversation')
  return o.ok ? { reply: `רשמתי: ${o.line}.`, ok: true } : { reply: `לא רשמתי — ${o.reason}`, ok: false }
}

export interface LedgerWrite { reply: string; ok: boolean }
/** If the text is an explicit family-fact "תזכרי ש…", write it (gated) and return the
 *  Hebrew reply; otherwise null (leave it to the normal memory/other path). */
export function ledgerWriteFromText(input: string, nowMs: number): LedgerWrite | null {
  const intake = classifyIntake(input)
  if (intake.kind === 'explicit' && intake.change) {
    const o = familyLedger().writeFact(intake.change, nowMs, 'conversation')
    return o.ok ? { reply: `רשמתי: ${o.line}.`, ok: true } : { reply: `לא רשמתי — ${o.reason}`, ok: false }
  }
  return null
}

/** Answer a "מי <relation> של <name>" from the LEDGER (conversation-added facts). Returns
 *  null when the ledger has nothing — the caller then keeps its existing behavior. */
export function ledgerFamilyAnswer(query: string): string | null {
  const l = familyLedger().ledger()
  const m = query.match(/מי\s+ה?(אשתו|אשת|בעלה|בעל|אבא|אמא|הורה|בן|בת|ילד|ילדים)\S*\s+של\s+([א-ת]{2,})/u)
  if (!m) return null
  const rel = m[1]!, name = m[2]!
  const p = l.get(name)
  if (!p) return null
  if (/אשת|בעל/.test(rel)) {
    const s = p.spouses[0]
    if (!s) return null
    const g = l.get(s)?.gender
    return `${name} נשוי${g === 'female' ? '' : ''} ל${s}.`
  }
  if (/אבא|אמא|הורה/.test(rel)) return p.parents.length ? `ההורים של ${name}: ${p.parents.join(', ')}.` : null
  if (/בן|בת|ילד/.test(rel)) {
    const kids = [...l.values()].filter((x) => x.parents.includes(name)).map((x) => x.id)
    return kids.length ? `הילדים של ${name}: ${kids.join(', ')}.` : null
  }
  return null
}
