/*
 * deviceGatedFlags.ts — the promotion ledger that makes a dark capability LOUD, not silent.
 * ════════════════════════════════════════════════════════════════════════════
 * THE FAILURE THIS PREVENTS (overnight item 1, the ONLINE_DEEP_FETCH lesson again).
 * Audio-tune, barge-in-truncate and prefetch all default OFF. That is CORRECT today —
 * each is gated on the owner's EAR (a device check a test cannot supply). But "off,
 * awaiting ear" and "off, silently forgotten after the ear said yes" look identical in
 * code. The first is right; the second ships Martita NONE of the audio work with nothing
 * failing loudly — exactly the invisible ONLINE_DEEP_FETCH merge hazard.
 *
 * So each device-gated flag carries a durable `promotionConfirmed` field:
 *   • false → the owner has NOT yet confirmed on device. OFF is correct. No failure.
 *   • true  → the owner's EAR confirmed it. The code default MUST now be ON. If it is
 *             still OFF, `assertDeviceGatedFlagIntegrity` THROWS — the merge fails LOUDLY
 *             instead of silently dropping a heard capability behind an unset env var.
 * A comment cannot enforce that. This module (and its test) does.
 *
 * `promotionConfirmed` is the ONE line the owner flips after AUDIO_CHECK.md passes — it is
 * the promotion step, machine-checked, that MERGE_READINESS.md points at. Nothing here reads
 * a secret or a network; it is a pure snapshot of the shipping defaults.
 */
import { LIVE_AUDIO_TUNE_V2, LIVE_BARGE_IN_TRUNCATE, LIVE_PREFETCH_WARM, LIVE_PREAMBLE_TWO_RESPONSE, LIVE_CLASSIFIED_MONITOR } from './liveSession'

export interface DeviceGatedFlag {
  /** Stable id (matches the code constant / FLAG_AUDIT.md row). */
  readonly id: string
  /** The build-time env override that force-enables it on a Preview A/B build. */
  readonly envVar: string
  /** The capability the owner LOSES if this ships OFF — for the loud startup line. */
  readonly capability: string
  /** The exact ear/device check that gates promotion (AUDIO_CHECK.md item). */
  readonly earCheck: string
  /** Effective value in THIS build (env override or code default). */
  readonly effective: boolean
  /** Flip to true ONLY after the owner's ear confirms. true + effective:false = LOUD failure. */
  readonly promotionConfirmed: boolean
}

/** The registry. `effective` reads the SAME source the runtime uses (no drift). Every
 *  `promotionConfirmed` starts false — the owner has not run AUDIO_CHECK.md yet. */
export const DEVICE_GATED_FLAGS: readonly DeviceGatedFlag[] = [
  {
    id: 'LIVE_AUDIO_TUNE_V2',
    envVar: 'VITE_LIVE_AUDIO_TUNE_V2',
    capability: 'far-field noise reduction (no second/overlapping voice at greeting)',
    earCheck: 'AUDIO_CHECK.md #2 — no second voice; #3 — no "one word then silence" (echo tamed)',
    effective: LIVE_AUDIO_TUNE_V2,
    promotionConfirmed: false,
  },
  {
    id: 'LIVE_BARGE_IN_TRUNCATE',
    envVar: 'VITE_LIVE_BARGE_IN_TRUNCATE',
    capability: 'clean barge-in (she stops when spoken over, no collision on the next turn)',
    earCheck: 'AUDIO_CHECK.md #3 — she stops cleanly; must ship WITH LIVE_AUDIO_TUNE_V2',
    effective: LIVE_BARGE_IN_TRUNCATE,
    promotionConfirmed: false,
  },
  {
    id: 'LIVE_PREFETCH_WARM',
    envVar: 'VITE_LIVE_PREFETCH_WARM',
    capability: 'sub-1s cached cinema/weather/headlines/transit answers',
    earCheck: 'device freshness-vs-latency off/on — a cached answer must not feel stale',
    effective: LIVE_PREFETCH_WARM,
    promotionConfirmed: false,
  },
  {
    id: 'LIVE_PREAMBLE_TWO_RESPONSE',
    envVar: 'VITE_LIVE_PREAMBLE_TWO_RESPONSE',
    capability: 'no spoken "רגע, אני בודקת…" before a looked-up answer (long-preamble fix)',
    earCheck: 'AUDIO_CHECK.md #5 — first words are the answer; the ~4s preamble gap is gone',
    effective: LIVE_PREAMBLE_TWO_RESPONSE,
    promotionConfirmed: false,
  },
  {
    id: 'LIVE_CLASSIFIED_MONITOR',
    envVar: 'VITE_LIVE_CLASSIFIED_MONITOR',
    capability: 'repairs a slipped method-narration / options-menu (0 FP on the classified corpus)',
    earCheck: 'EAR_CHECK.md #4 — a redo does not make her stilted or slow; no method-narration is heard',
    effective: LIVE_CLASSIFIED_MONITOR,
    promotionConfirmed: false,
  },
]

/** THROWS (loud) if any flag was ear-confirmed but is still shipping OFF — i.e. a promotion
 *  that was approved on device but never flipped in code. Off-and-unconfirmed is fine (the
 *  correct pre-ear state). Run in a test and at startup so a merge cannot forget silently. */
export function assertDeviceGatedFlagIntegrity(flags: readonly DeviceGatedFlag[] = DEVICE_GATED_FLAGS): void {
  const dropped = flags.filter((f) => f.promotionConfirmed && !f.effective)
  if (dropped.length > 0) {
    const names = dropped.map((f) => `${f.id} (set ${f.envVar}=1 OR flip its code default ON)`).join('; ')
    throw new Error(
      `DEVICE-GATED FLAG DROPPED SILENTLY: ${names}. ` +
      `These were ear-confirmed (promotionConfirmed=true) but ship OFF — Martita would lose the capability. ` +
      `Promote the code default or the merge is a regression.`,
    )
  }
}

/** Human-readable startup lines: which heard capabilities are dark, and why. Logged LOUDLY at
 *  boot so "off, awaiting ear" is never invisible. Not an error — a visible state report. */
export function deviceGatedFlagStartupReport(flags: readonly DeviceGatedFlag[] = DEVICE_GATED_FLAGS): string[] {
  return flags.map((f) => {
    const state = f.effective ? 'ON' : f.promotionConfirmed ? 'OFF — ⚠ CONFIRMED BUT DROPPED' : 'OFF — awaiting owner ear'
    return `[device-gated] ${f.id}=${state} · ${f.capability} · gate: ${f.earCheck}`
  })
}

/** True when at least one device-gated capability is dark (for a one-line boot summary). */
export function anyDeviceGatedCapabilityDark(flags: readonly DeviceGatedFlag[] = DEVICE_GATED_FLAGS): boolean {
  return flags.some((f) => !f.effective)
}
