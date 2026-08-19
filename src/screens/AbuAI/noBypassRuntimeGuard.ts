/*
 * No-Bypass Runtime Guard
 * ═══════════════════════
 * The invariant that PROVES the no-bypass property: any answer that reaches the UI
 * or TTS must carry a RUNTIME_FINALIZED trace (i.e. it went input → intent →
 * finalize → supervise → deliver). Legacy modules produce structured tool results,
 * never a stamped answer — so a stamp is only obtainable by passing through
 * `runtimeFinalizer`. Tests assert every emitted answer passes this guard.
 */
import { isFinalized, type RuntimeTrace } from './runtimeTrace'

export interface Emittable { display: string; speak: string; trace?: RuntimeTrace }

/** True iff this answer is safe to emit (produced by the runtime finalizer). */
export function isEmittable(a: Emittable | null | undefined): boolean {
  return !!a && typeof a.display === 'string' && a.display.trim().length > 0 && isFinalized(a.trace)
}

/** Throws if an answer would be emitted without passing the runtime — for dev/tests. */
export function assertNoBypass(a: Emittable, where: string): void {
  if (!isEmittable(a)) {
    throw new Error(`[no-bypass] answer at "${where}" was not RUNTIME_FINALIZED — legacy bypass`)
  }
}
