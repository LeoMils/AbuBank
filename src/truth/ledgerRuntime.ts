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
import { type Change, type FactKind, FACT_LABEL_HE } from './familyLaws'

export function familyLedger(): LedgerService { return new LedgerService(localLedgerStore()) }

/** Stamp a chapter fact with the real time of writing (extractChange leaves at=0). */
function stamp(change: Change, nowMs: number): Change {
  return change.op === 'addFact' ? { ...change, fact: { ...change.fact, at: nowMs } } : change
}

/** Commit an already-parsed Change (e.g. a soft-confirmed pending fact) through the gate. */
export function ledgerCommit(change: Change, nowMs: number): LedgerWrite {
  const o = familyLedger().writeFact(stamp(change, nowMs), nowMs, 'conversation')
  return o.ok ? { reply: `רשמתי: ${o.line}.`, ok: true } : { reply: `לא רשמתי — ${o.reason}`, ok: false }
}

export interface LedgerWrite { reply: string; ok: boolean }
/** If the text is an explicit family-fact "תזכרי ש…", write it (gated) and return the
 *  Hebrew reply; otherwise null (leave it to the normal memory/other path). */
export function ledgerWriteFromText(input: string, nowMs: number): LedgerWrite | null {
  const intake = classifyIntake(input)
  if (intake.kind === 'explicit' && intake.change) {
    const o = familyLedger().writeFact(stamp(intake.change, nowMs), nowMs, 'conversation')
    return o.ok ? { reply: `רשמתי: ${o.line}.`, ok: true } : { reply: `לא רשמתי — ${o.reason}`, ok: false }
  }
  return null
}

/** Answer a PERSONAL question ("איפה גר X", "מה X אוהב", "מה את יודעת על X") from the
 *  person's ledger chapter. Returns null when the chapter has nothing on it. */
export function ledgerChapterAnswer(query: string): string | null {
  const l = familyLedger().ledger()
  const latest = (name: string, kind: FactKind): string | null => {
    const fs = l.get(name)?.facts?.filter((f) => f.kind === kind) ?? []
    return fs.length ? fs[fs.length - 1]!.value : null
  }
  let m = query.match(/איפה\s+גר[הת]?\s+([א-ת]{2,})|איפה\s+([א-ת]{2,})\s+גר[הת]?/u)
  if (m) { const n = (m[1] ?? m[2])!; const v = latest(n, 'residence'); return v ? `${n} גר/ה ב${v}.` : null }
  m = query.match(/איפה\s+עובד[הת]?\s+([א-ת]{2,})|([א-ת]{2,})\s+עובד[הת]?\s*\?|מה\s+([א-ת]{2,})\s+עוש[הת]/u)
  if (m) { const n = (m[1] ?? m[2] ?? m[3])!; const v = latest(n, 'work'); return v ? `${n} עובד/ת ב${v}.` : null }
  m = query.match(/מה\s+([א-ת]{2,})\s+אוהב[הת]?|התחביב\S*\s+של\s+([א-ת]{2,})/u)
  if (m) { const n = (m[1] ?? m[2])!; const prefs = l.get(n)?.facts?.filter((f) => f.kind === 'preference' || f.kind === 'hobby').map((f) => f.value) ?? []; return prefs.length ? `${n} אוהב/ת ${prefs.join(', ')}.` : null }
  m = query.match(/(?:מה\s+את\s+יודעת|ספרי\s+לי|מה\s+יש\s+לך)\s+על\s+([א-ת]{2,})/u)
  if (m) { const p = l.get(m[1]!); if (p?.facts?.length) return `${m[1]}: ${p.facts.map((f) => `${FACT_LABEL_HE[f.kind]} ${f.value}`).join('; ')}.`; return null }
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
