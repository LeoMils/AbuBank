/*
 * Realtime model — ONE shared constant (Defect 3: model drift)
 * ════════════════════════════════════════════════════════════
 * The Realtime model name was hard-coded in three independent places
 * (realtimeVoice.ts, api/realtime-token.ts, index.tsx diagnostics), so the client
 * secret, the SDP call, health, and Product Truth could silently disagree. This is
 * now the SINGLE source of truth, imported everywhere, and asserted by tests.
 *
 * `gpt-realtime` is the current GA family alias (it resolves to the newest GA
 * snapshot server-side). We expose the alias AND the known dated snapshots so a
 * server probe can pick the newest one this account actually supports without a
 * blind version bump. The client and the token minter MUST use the same value —
 * `assertNoModelDrift` enforces that at the SDP boundary.
 */

/** The production model alias (resolves server-side to the newest GA snapshot). */
export const REALTIME_MODEL = 'gpt-realtime' as const

/** Known dated snapshots, newest first. A server probe tries these in order and
 *  records which the account supports; the newest supported wins. */
export const REALTIME_MODEL_CANDIDATES = [
  'gpt-realtime-2.1',
  'gpt-realtime',
] as const

export type RealtimeModel = string

/** Reject a mismatch between the model used to mint the ephemeral secret and the
 *  model used in the SDP call — that drift silently breaks the session. */
export function assertNoModelDrift(mintModel: string, sdpModel: string): void {
  if (mintModel !== sdpModel) {
    throw new Error(`realtime model drift: mint=${mintModel} sdp=${sdpModel}`)
  }
}

/** True when a name is a recognized Realtime model (alias or dated snapshot). */
export function isKnownRealtimeModel(name: string): boolean {
  return name === REALTIME_MODEL || (REALTIME_MODEL_CANDIDATES as readonly string[]).includes(name)
}
