/*
 * AbuAI COST MODEL (Item 2 · "the first real number").
 * ════════════════════════════════════════════════════════════════════════════
 * A pure, deterministic cost calculator for a live (Realtime) voice conversation,
 * used to quantify what the O-LIFECYCLE idle-stop (sessionLifecycle.ts) actually
 * saves, and what the quality bugs (stalls → repeated turns, repetitions → wasted
 * output) were costing.
 *
 * EVIDENCE CLASS: CODE (a model fed by real published rates), NOT a billed number.
 * A real billed figure requires a keyed Realtime session on a device — that is
 * PHYSICAL_DEVICE/PRODUCTION class and is Leo's to capture. Everything here is the
 * transparent arithmetic that turns a session PROFILE into a cost at a stated rate.
 * The percentage saving is rate-independent; the shekel figure is shown WITH its
 * rate so it can be re-derived when the published price or FX changes.
 *
 * RATES: OpenAI Realtime API (gpt-4o-realtime) audio, published approximate
 * per-minute pricing. Kept as ONE named constant block so a price change is a
 * one-line edit, never scattered. Update RATES + cite the source when OpenAI
 * changes the price. Audio dominates realtime cost; text tokens are folded in as
 * a small additive term for completeness.
 */

// ─── Published rates (single source; update here on any price/FX change) ─────
export const RATES = {
  // gpt-4o-realtime audio, USD per MINUTE (published approximate figures).
  audioInputUsdPerMin: 0.06, // her microphone streamed UPSTREAM (billed even when idle)
  audioOutputUsdPerMin: 0.24, // Abu speaking (billed only while producing audio)
  // Text side (function-call args, transcripts) — minor vs audio. USD per 1K tokens.
  textInputUsdPer1k: 0.005,
  textOutputUsdPer1k: 0.02,
  usdToIls: 3.7, // FX for the shekel figure (label it; re-derive when it moves)
} as const

// ─── Session profile — the observable shape of a conversation ────────────────
export interface SessionProfile {
  /** Total wall-clock length of the live session, minutes. */
  totalMinutes: number
  /** Minutes Martita is actively speaking (her mic carries real speech). */
  activeUserMinutes: number
  /** Minutes Abu is actively speaking (audio output produced). */
  abuSpeakingMinutes: number
  /** Number of distinct idle gaps (she pauses / thinks / steps away). */
  idleGaps: number
  /** Text tokens in/out over the whole session (function calls, transcripts). */
  textInputTokens: number
  textOutputTokens: number
}

export interface CostBreakdown {
  audioInputUsd: number
  audioOutputUsd: number
  textUsd: number
  totalUsd: number
  totalIls: number
  /** Minutes her mic was actually streamed upstream (the idle-cost driver). */
  billedUpstreamMinutes: number
}

function round(n: number, dp = 4): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

/**
 * Cost a session given how many minutes her mic was actually streamed upstream.
 * `upstreamMinutes` is the ONLY lever the lifecycle changes: BEFORE it, the mic
 * streamed for the whole session; AFTER, it stops ~12s into each idle gap.
 */
export function costSessionWithUpstream(p: SessionProfile, upstreamMinutes: number): CostBreakdown {
  const audioInputUsd = upstreamMinutes * RATES.audioInputUsdPerMin
  const audioOutputUsd = p.abuSpeakingMinutes * RATES.audioOutputUsdPerMin
  const textUsd =
    (p.textInputTokens / 1000) * RATES.textInputUsdPer1k +
    (p.textOutputTokens / 1000) * RATES.textOutputUsdPer1k
  const totalUsd = audioInputUsd + audioOutputUsd + textUsd
  return {
    audioInputUsd: round(audioInputUsd),
    audioOutputUsd: round(audioOutputUsd),
    textUsd: round(textUsd),
    totalUsd: round(totalUsd),
    totalIls: round(totalUsd * RATES.usdToIls, 2),
    billedUpstreamMinutes: round(upstreamMinutes, 2),
  }
}

/** ~12s of upstream is billed after speech before the idle-stop fires, per gap. */
export const IDLE_TAIL_MINUTES = 12 / 60

/**
 * BEFORE the lifecycle: the mic streams upstream for the ENTIRE session — every
 * silent minute while she thinks, reads, or steps away is billed as audio input.
 */
export function costBefore(p: SessionProfile): CostBreakdown {
  return costSessionWithUpstream(p, p.totalMinutes)
}

/**
 * AFTER the lifecycle: upstream is billed only while she actually speaks, plus a
 * ~12s tail per idle gap before the idle-stop fires, and the session closes at
 * 45s of continuous silence (so trailing idle is never billed at all).
 */
export function costAfter(p: SessionProfile): CostBreakdown {
  const upstream = Math.min(
    p.totalMinutes,
    p.activeUserMinutes + p.idleGaps * IDLE_TAIL_MINUTES,
  )
  return costSessionWithUpstream(p, upstream)
}

export interface LifecycleComparison {
  before: CostBreakdown
  after: CostBreakdown
  savingUsd: number
  savingIls: number
  savingPct: number
}

/** The headline: before vs after the idle-stop, with the saving in ₪ and %. */
export function compareLifecycle(p: SessionProfile): LifecycleComparison {
  const before = costBefore(p)
  const after = costAfter(p)
  const savingUsd = round(before.totalUsd - after.totalUsd)
  return {
    before,
    after,
    savingUsd,
    savingIls: round(savingUsd * RATES.usdToIls, 2),
    savingPct: before.totalUsd > 0 ? round((savingUsd / before.totalUsd) * 100, 1) : 0,
  }
}

// ─── What the QUALITY bugs were costing ──────────────────────────────────────
export interface QualityBugProfile {
  /** Stalls where Abu said she would check and went silent → the user repeats the
   *  turn. Each stall costs one extra round-trip (her repeat + Abu re-answer). */
  stalls: number
  /** Average audio-output minutes wasted per stall (the re-answer). */
  avgRepeatOutputMinutes: number
  /** Average upstream minutes wasted per stall (her repeated ask). */
  avgRepeatUpstreamMinutes: number
  /** Formulations repeated verbatim (wasted output tokens), count. */
  repeatedFormulations: number
  /** Output tokens per repeated formulation. */
  tokensPerFormulation: number
}

/** Cost of the quality bugs per session — the argument that quality pays for itself. */
export function qualityBugCost(q: QualityBugProfile): { usd: number; ils: number } {
  const stallOutputUsd = q.stalls * q.avgRepeatOutputMinutes * RATES.audioOutputUsdPerMin
  const stallUpstreamUsd = q.stalls * q.avgRepeatUpstreamMinutes * RATES.audioInputUsdPerMin
  const repeatTextUsd =
    (q.repeatedFormulations * q.tokensPerFormulation / 1000) * RATES.textOutputUsdPer1k
  const usd = round(stallOutputUsd + stallUpstreamUsd + repeatTextUsd)
  return { usd, ils: round(usd * RATES.usdToIls, 2) }
}

/**
 * A REPRESENTATIVE 20-minute companion session for an 80-year-old: she speaks in
 * bursts, then pauses to think / read / step away. Conservative, not worst-case.
 * These are the profile INPUTS (observable, defensible), not magic cost numbers.
 */
export function representative20MinSession(): SessionProfile {
  return {
    totalMinutes: 20,
    activeUserMinutes: 5, // ~25% of the time she is actually speaking
    abuSpeakingMinutes: 4, // Abu's replies (2–4 sentence answers)
    idleGaps: 8, // eight distinct pauses across the 20 minutes
    textInputTokens: 3000,
    textOutputTokens: 4000,
  }
}
