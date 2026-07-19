/*
 * LEDGER SERVICE — the living family ledger (Constitution §1).
 * ═══════════════════════════════════════════════════════════
 * ONE canonical state; ONE door. Every fact — from a conversation, an explicit
 * "תזכרי ש…", or Leo's manual upload — is written through THE LAWS gate
 * (familyLaws.applyChange), so a contradiction can never enter. The ledger is a pure
 * function of (seed, change-log): file-as-view. Every change is one log line and is
 * UNDOABLE (pop the log, replay from the seed). Reuses familyLaws — no parallel path.
 */
import { type Ledger, type LedgerPerson, type Change, applyChange, describeChange } from './familyLaws'
import { seedLedgerFromGraph } from './ledgerSeed'
import { renderLedgerHebrew } from './ledgerView'
import { curateLog, type CurationResult } from './ledgerCurator'

/** The person ids a change references (for auto-creating unknown relatives). */
function referencedIds(c: Change): string[] {
  switch (c.op) {
    case 'addPerson': return [c.person.id]
    case 'addParent': return [c.child, c.parent]
    case 'addSpouse': case 'addSibling': return [c.a, c.b]
    case 'divorce': return [c.a, c.b]
    case 'setBirthdate': return [c.id]
  }
}
const newPerson = (id: string): LedgerPerson => ({ id, name: id, gender: 'unknown', parents: [], spouses: [], exSpouses: [], aliases: [] })

export interface LogEntry { at: number; line: string; change: Change; source: string }
export interface LedgerStore { load(): string | null; save(json: string): void }

/** In-memory store (tests / SSR). */
export function memoryStore(): LedgerStore { let v: string | null = null; return { load: () => v, save: (j) => { v = j } } }
/** localStorage-backed store (browser). Never throws. */
export function localLedgerStore(key = 'abu-family-ledger'): LedgerStore {
  return {
    load: () => { try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null } catch { return null } },
    save: (j) => { try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, j) } catch { /* ignore */ } },
  }
}

/** Replay a change-log onto the seed via the gate — the ledger IS this function. */
function replay(seed: Ledger, log: LogEntry[]): Ledger {
  let cur = seed
  for (const e of log) { const r = applyChange(cur, e.change); if (r.ok) cur = r.ledger }
  return cur
}

export interface WriteOutcome { ok: boolean; line: string | null; reason: string | null }

export class LedgerService {
  private log: LogEntry[] = []
  private cache: Ledger
  constructor(private store: LedgerStore = memoryStore(), private seedFn: () => Ledger = seedLedgerFromGraph) {
    const saved = this.store.load()
    if (saved) { try { this.log = (JSON.parse(saved) as { log: LogEntry[] }).log ?? [] } catch { this.log = [] } }
    this.cache = replay(this.seedFn(), this.log)
  }

  /** The current ledger (derived from seed + log). */
  ledger(): Ledger { return this.cache }
  getLog(): LogEntry[] { return [...this.log] }

  /** Write ONE fact through THE LAWS gate. On rejection nothing persists (poison never stores). */
  write(change: Change, at: number, source = 'conversation'): WriteOutcome {
    const r = applyChange(this.cache, change)
    if (!r.ok) return { ok: false, line: null, reason: r.violations.map((v) => v.message).join(' ') }
    this.cache = r.ledger
    this.log.push({ at, line: r.log!, change, source })
    this.persist()
    return { ok: true, line: r.log!, reason: null }
  }

  /** Manual upload / multi-fact: a one-line diff per fact (accepted or rejected). */
  upload(changes: Change[], at: number, source = 'upload'): Array<{ line: string; accepted: boolean; reason: string }> {
    return changes.map((c) => {
      const o = this.write(c, at, source)
      return o.ok ? { line: o.line!, accepted: true, reason: o.line! } : { line: describeChange(c), accepted: false, reason: o.reason! }
    })
  }

  /**
   * Write a FACT, auto-creating any UNKNOWN person the fact names (a new relative Leo
   * introduces), then the relation — ATOMICALLY through THE LAWS gate. If the relation is
   * refused (a contradiction), NOTHING is committed (not even the new people). One log line.
   */
  writeFact(change: Change, at: number, source = 'conversation'): WriteOutcome {
    const unknown = referencedIds(change).filter((id) => !this.cache.has(id))
    const batch: Change[] = [...unknown.map((id) => ({ op: 'addPerson' as const, person: newPerson(id) })), change]
    // Simulate the whole batch first; only if the KEY (last) change is accepted do we commit.
    let sim: Ledger = this.cache
    const accepted: Change[] = []
    for (const c of batch) {
      const r = applyChange(sim, c)
      if (r.ok) { sim = r.ledger; accepted.push(c) }
      else if (c === change) return { ok: false, line: null, reason: r.violations.map((v) => v.message).join(' ') }
    }
    // Commit every accepted change to the log (so replay/undo can reconstruct the people).
    this.cache = sim
    for (const c of accepted) this.log.push({ at, line: describeChange(c), change: c, source })
    this.persist()
    return { ok: true, line: describeChange(change), reason: null }
  }

  /** Undo the last change (§ every change undoable). Rebuilds the ledger from the seed. */
  undo(): boolean {
    if (!this.log.length) return false
    this.log.pop()
    this.cache = replay(this.seedFn(), this.log)
    this.persist()
    return true
  }

  /** File-as-view: regenerate the canonical human-readable Hebrew ledger from state. */
  renderHebrew(): string { return renderLedgerHebrew(this.cache, this.log) }

  /**
   * CURATOR (nightly): dedupe/supersede/reorder the log WITHOUT deleting a fact. Returns the
   * one-line Hebrew actions. The whole curation is undoable (undoCuration restores the log).
   */
  curate(): CurationResult {
    const r = curateLog(this.log)
    if (r.actions.length) {
      this.preCuration = [...this.log]
      this.log = r.cleanedLog
      this.cache = replay(this.seedFn(), this.log)
      this.persist()
    }
    return r
  }
  /** Revert the last curation (§ every change undoable). */
  undoCuration(): boolean {
    if (!this.preCuration) return false
    this.log = this.preCuration
    this.preCuration = null
    this.cache = replay(this.seedFn(), this.log)
    this.persist()
    return true
  }
  private preCuration: LogEntry[] | null = null

  private persist() { this.store.save(JSON.stringify({ log: this.log })) }
}
