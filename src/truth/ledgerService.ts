/*
 * LEDGER SERVICE — the living family ledger (Constitution §1).
 * ═══════════════════════════════════════════════════════════
 * ONE canonical state; ONE door. Every fact — from a conversation, an explicit
 * "תזכרי ש…", or Leo's manual upload — is written through THE LAWS gate
 * (familyLaws.applyChange), so a contradiction can never enter. The ledger is a pure
 * function of (seed, change-log): file-as-view. Every change is one log line and is
 * UNDOABLE (pop the log, replay from the seed). Reuses familyLaws — no parallel path.
 */
import { type Ledger, type Change, applyChange, describeChange } from './familyLaws'
import { seedLedgerFromGraph } from './ledgerSeed'
import { renderLedgerHebrew } from './ledgerView'

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

  private persist() { this.store.save(JSON.stringify({ log: this.log })) }
}
