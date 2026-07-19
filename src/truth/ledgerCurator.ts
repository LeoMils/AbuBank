/*
 * LEDGER CURATOR — the nightly tidy-up (Constitution §3, autopilot).
 * ════════════════════════════════════════════════════════════════
 * Reorganizes the change-log without EVER deleting a fact: chronological order, dedupe
 * of identical facts stated twice, and supersession (a newer value replaces an older one
 * for the SAME target — e.g. a corrected birthdate). It NEVER drops a person and never
 * removes information the ledger still needs to replay. Every substantive change is
 * reported as one Hebrew line and the whole curation is undoable (the pre-curation log is
 * kept). Pure over the log — the ledger is still `replay(seed, log)`.
 */
import type { LogEntry } from './ledgerService'
import type { Change } from './familyLaws'

export type CurationKind = 'reorder' | 'dedupe' | 'supersede'
export interface CurationAction { kind: CurationKind; line: string }
export interface CurationResult { cleanedLog: LogEntry[]; actions: CurationAction[] }

/** A stable identity for a change (for dedupe). */
function changeKey(c: Change): string {
  switch (c.op) {
    case 'addPerson': return `addPerson|${c.person.id}|${c.person.name}`
    case 'addParent': return `addParent|${c.child}|${c.parent}`
    case 'addSpouse': return `addSpouse|${[c.a, c.b].sort().join('~')}`
    case 'addSibling': return `addSibling|${[c.a, c.b].sort().join('~')}`
    case 'divorce': return `divorce|${[c.a, c.b].sort().join('~')}`
    case 'setBirthdate': return `setBirthdate|${c.id}|${c.birthdate}`
  }
}
/** The target whose LATEST value supersedes earlier ones (birthdate, a person record). */
function supersedeKey(c: Change): string | null {
  if (c.op === 'setBirthdate') return `setBirthdate:${c.id}`
  if (c.op === 'addPerson') return `addPerson:${c.person.id}`
  return null
}

export function curateLog(log: LogEntry[]): CurationResult {
  const actions: CurationAction[] = []

  // 1) Chronological order (stable on ties).
  const ordered = log.map((e, i) => ({ e, i })).sort((a, b) => a.e.at - b.e.at || a.i - b.i).map((x) => x.e)
  if (ordered.some((e, i) => e !== log[i])) actions.push({ kind: 'reorder', line: 'סודר היומן לפי תאריך' })

  // 2) Dedupe identical facts (keep the FIRST; the fact itself survives).
  const seen = new Set<string>()
  const deduped: LogEntry[] = []
  for (const e of ordered) {
    const k = changeKey(e.change)
    if (seen.has(k)) { actions.push({ kind: 'dedupe', line: `אוחד כפל: ${e.line}` }); continue }
    seen.add(k)
    deduped.push(e)
  }

  // 3) Supersession — a newer value for the SAME target replaces the older, IN PLACE (so
  // order is preserved). The fact is not deleted; its value is updated to the latest.
  const at = new Map<string, number>()
  const result: LogEntry[] = []
  for (const e of deduped) {
    const sk = supersedeKey(e.change)
    if (sk && at.has(sk)) {
      const idx = at.get(sk)!
      actions.push({ kind: 'supersede', line: `עודכן (גרסה חדשה גוברת): ${result[idx]!.line} → ${e.line}` })
      result[idx] = e // latest value wins, keeps its slot
      continue
    }
    if (sk) at.set(sk, result.length)
    result.push(e)
  }

  return { cleanedLog: result, actions }
}
