/*
 * TURN AUTHORITY ARBITER (ADR-0001 §5 — live ownership law).
 * ════════════════════════════════════════════════════════════════════════════
 * The deterministic lifecycle/ownership component that guarantees EXACTLY ONE
 * TALK / one response / one output authority per logical live voice turn. It is
 * NOT an intent classifier and NOT a dialogue model — it only issues + enforces
 * leases and records the reason for every grant/reject/transfer.
 *
 * Root defect it fixes (device-falsified): in ?voice=realtime2 the Realtime model
 * spoke (create_response=true) AND the legacy ExecutiveCognitiveController also
 * called realtimeRef.speak() for the SAME turn → overlapping audio + a second
 * acting brain. Ownership under ADR-0001:
 *   REALTIME_ACTIVE → model owns TALK; the legacy brain may NOT speak/act/commit.
 *   FALLBACK_ACTIVE → the pipeline owns TALK; realtime output is cancelled+drained
 *     first; they never speak concurrently.
 *   TERMINATED      → no owner.
 */

export type RuntimeMode = 'REALTIME_ACTIVE' | 'FALLBACK_ACTIVE' | 'TERMINATED'
export type TalkOwner = 'model' | 'legacy_brain' | 'none'

export interface Decision { granted: boolean; reason: string }

export class TurnAuthorityArbiter {
  private mode: RuntimeMode = 'TERMINATED'
  private generation = 0
  private turnSeq = 0
  private currentTurn: string | null = null
  private talkOwner: TalkOwner = 'none'
  private responseLeases = 0          // active response.create leases for the current turn
  private readonly log: string[] = []

  private note(s: string): void { this.log.push(s) }
  reasons(): string[] { return [...this.log] }
  get runtimeMode(): RuntimeMode { return this.mode }
  get gen(): number { return this.generation }
  get talk(): TalkOwner { return this.talkOwner }

  /** Enter realtime ownership (bumps generation so pre-transfer callbacks are stale). */
  activateRealtime(): void { this.mode = 'REALTIME_ACTIVE'; this.generation += 1; this.note(`mode=REALTIME_ACTIVE gen=${this.generation}`) }

  /** Transfer to fallback: realtime output MUST be cancelled+drained first; transfer once. */
  activateFallback(): { transferred: boolean; drainRealtime: boolean } {
    if (this.mode === 'FALLBACK_ACTIVE') { this.note('fallback already active — no double transfer'); return { transferred: false, drainRealtime: false } }
    const drain = this.mode === 'REALTIME_ACTIVE'
    this.mode = 'FALLBACK_ACTIVE'; this.generation += 1; this.talkOwner = 'none'; this.responseLeases = 0
    this.note(`transfer→FALLBACK_ACTIVE gen=${this.generation} drainRealtime=${drain}`)
    return { transferred: true, drainRealtime: drain }
  }

  terminate(): void { this.mode = 'TERMINATED'; this.talkOwner = 'none'; this.responseLeases = 0; this.currentTurn = null; this.note('mode=TERMINATED') }

  /** Begin a new logical turn — resets the per-turn TALK + response leases. */
  beginTurn(): string { this.turnSeq += 1; this.currentTurn = `turn_${this.turnSeq}`; this.talkOwner = 'none'; this.responseLeases = 0; return this.currentTurn }

  /** Grant TALK to exactly one authority for the current turn (idempotent for the same owner). */
  requestTalk(who: Exclude<TalkOwner, 'none'>): Decision {
    if (this.mode === 'TERMINATED') return this.reject(`talk denied: TERMINATED`)
    // In realtime mode only the model may talk; the legacy brain is rejected.
    if (this.mode === 'REALTIME_ACTIVE' && who === 'legacy_brain') return this.reject('talk denied: legacy_brain during REALTIME_ACTIVE (model owns TALK)')
    if (this.mode === 'FALLBACK_ACTIVE' && who === 'model') return this.reject('talk denied: model after fallback took ownership')
    if (this.talkOwner !== 'none' && this.talkOwner !== who) return this.reject(`talk denied: turn already owned by ${this.talkOwner}`)
    this.talkOwner = who; this.note(`talk granted: ${who}`); return { granted: true, reason: 'ok' }
  }

  /** At most ONE response.create per turn — a second is rejected (dedup duplicate audio). */
  requestResponseLease(): Decision {
    if (this.responseLeases >= 1) return this.reject('response denied: a response already active for this turn')
    this.responseLeases += 1; this.note('response lease granted'); return { granted: true, reason: 'ok' }
  }
  releaseResponse(): void { if (this.responseLeases > 0) this.responseLeases -= 1 }

  /** The legacy brain may SPEAK only when it is not realtime-owned. */
  canLegacySpeak(): boolean { return this.mode !== 'REALTIME_ACTIVE' }
  /** The legacy brain may mutate/commit ACTION state only when it is not realtime-owned. */
  canLegacyAct(): boolean { return this.mode !== 'REALTIME_ACTIVE' }

  /** Reject a callback from a stale generation/session (post-transfer). */
  isStale(generation: number): boolean { return generation !== this.generation }

  private reject(reason: string): Decision { this.note(reason); return { granted: false, reason } }
}
