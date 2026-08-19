/*
 * Evolution OS — signal intelligence (Section 7)
 * ══════════════════════════════════════════════
 * A unified taxonomy over three signal families, each with a strength tier:
 *   • explicit   — the user SAID it was wrong / right (correction, undo, thanks).
 *   • implicit   — behavior implies trouble (immediate repeat, modality switch,
 *                  undo after an action). Probabilistic — never definitive.
 *   • automatic  — deterministic contradictions in the trace itself (claimed a
 *                  save that never committed; said "no info" while a tool returned
 *                  data; TTS text ≠ approved text; emitted an unapproved answer).
 *
 * Strength (Section 7): GOLD (act-worthy), SILVER (strong, needs corroboration),
 * BRONZE (weak — clustering/investigation only, MUST NOT drive learning alone).
 *
 * Pure functions over a window of envelopes (most-recent LAST). Bilingual
 * (Hebrew + Rioplatense Spanish) because Martita speaks both.
 */
import type { AbuTraceEnvelope } from './traceEnvelope'
import type { FailureLayer } from './failureTaxonomy'

export type SignalCategory = 'explicit' | 'implicit' | 'automatic'
export type SignalStrength = 'gold' | 'silver' | 'bronze'

export interface Signal {
  kind: string
  category: SignalCategory
  strength: SignalStrength
  turnId: string          // the turn the signal is ABOUT (usually the prior turn for explicit)
  sessionId: string
  layerHint?: FailureLayer
  evidence: string
  confidence: number      // 0..1
  polarity: 'failure' | 'success'
}

// ── Lexicons (bilingual) ─────────────────────────────────────────────────────
// NOTE: no `\b` — JavaScript's word boundary is ASCII-only and NEVER matches next
// to a Hebrew letter, which would silently disable every Hebrew detector. Substring
// matching is the correct primitive for these heuristic cues.
const RE_CORRECTION = /(לא נכון|זה לא נכון|טעית|לא זה|לא ככה|לא הבנת|לא זה מה|תתקני|תקני|לא אמרתי|no es así|está mal|eso no|no era eso|te equivocaste|corregí|no entendiste)/iu
const RE_UNDO = /(בטלי|תבטלי|בטל|תמחקי|מחקי|תמחק|לא רוצה|תחזירי|undo|cancelá|cancela|borrá|borra|eliminá|no quiero)/iu
const RE_SUCCESS = /(תודה|מושלם|יופי|בדיוק|כן נכון|נכון מאוד|gracias|perfecto|exacto|así es|dale gracias)/iu

// assistant CLAIMS it saved / created something (calendar/reminder)
const RE_CLAIM_SAVED = /(שמרתי|קבעתי|הוספתי|רשמתי|יצרתי|נקבע|הוסף ליומן|guardé|agendé|creé|anoté|lo puse|quedó agendado)/iu
// assistant claims NO information
const RE_NO_INFO = /(אין לי|לא יודעת|לא ידוע לי|אין מידע|לא מצאתי|no tengo|no sé|no encontré|no hay)/iu

function normalize(s?: string): string {
  return (s ?? '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}

/** Jaccard token similarity — cheap "is this basically the same request?" measure. */
export function tokenSimilarity(a?: string, b?: string): number {
  const ta = new Set(normalize(a).split(' ').filter(Boolean))
  const tb = new Set(normalize(b).split(' ').filter(Boolean))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / (ta.size + tb.size - inter)
}

function committedSomething(e: AbuTraceEnvelope): boolean {
  if (Array.isArray(e.committedStateChanges) && e.committedStateChanges.length > 0) return true
  return (e.toolCalls ?? []).some(t => /calendar|reminder|create|commit/i.test(t.toolName) && /ok|success|committed|done/i.test(t.status))
}

// ── Automatic deterministic signals (single-turn) ────────────────────────────
export function detectAutomatic(e: AbuTraceEnvelope): Signal[] {
  const out: Signal[] = []
  const base = { turnId: e.turnId, sessionId: e.sessionId, polarity: 'failure' as const }
  const answer = e.assistantText ?? ''

  // 1) Claimed a save/commit that no committed change or successful tool supports.
  if (RE_CLAIM_SAVED.test(answer) && !committedSomething(e)) {
    out.push({ ...base, kind: 'claimed_saved_not_committed', category: 'automatic', strength: 'gold',
      layerHint: 'state_commitment', confidence: 0.9,
      evidence: 'assistant claimed a save/create but no committed change or successful commit tool was recorded' })
  }
  // 2) Said "no info" while a tool actually returned facts.
  const toolReturnedFacts = (e.toolCalls ?? []).some(t => /ok|success/i.test(t.status) && (t.resultRedacted?.length ?? 0) > 0)
  if (RE_NO_INFO.test(answer) && toolReturnedFacts) {
    out.push({ ...base, kind: 'no_info_but_retrieval_returned', category: 'automatic', strength: 'gold',
      layerHint: 'response_reasoning', confidence: 0.85,
      evidence: 'assistant claimed no information while a tool returned data' })
  }
  // 3) TTS text materially differs from the approved assistant text.
  if (e.ttsInput && e.assistantText && tokenSimilarity(e.ttsInput, e.assistantText) < 0.4) {
    out.push({ ...base, kind: 'tts_diverges_from_approved', category: 'automatic', strength: 'gold',
      layerHint: 'voice_synthesis', confidence: 0.8,
      evidence: 'TTS input diverges materially from the approved answer text' })
  }
  // 4) An unapproved answer was still emitted.
  if (e.supervisorApproved === false && (answer.length > 0)) {
    out.push({ ...base, kind: 'unapproved_answer_emitted', category: 'automatic', strength: 'gold',
      layerHint: 'response_reasoning', confidence: 0.75,
      evidence: `supervisor did not approve (${(e.supervisorReasons ?? []).join(',')}) yet an answer was emitted` })
  }
  // 5) Silent fallback with no recorded error — an observability gap.
  if (e.source === 'fallback' && !e.error) {
    out.push({ ...base, kind: 'silent_fallback', category: 'automatic', strength: 'silver',
      layerHint: 'observability_gap', confidence: 0.6,
      evidence: 'runtime fell back without recording a reason' })
  }
  return out
}

// ── Explicit signals (the NEXT turn judges the PRIOR turn) ────────────────────
export function detectExplicit(prev: AbuTraceEnvelope | undefined, cur: AbuTraceEnvelope): Signal[] {
  if (!prev) return []
  const text = cur.normalizedInput ?? ''
  const out: Signal[] = []
  if (RE_CORRECTION.test(text)) {
    out.push({ kind: 'user_correction', category: 'explicit', strength: 'gold', turnId: prev.turnId,
      sessionId: cur.sessionId, confidence: 0.9, polarity: 'failure',
      evidence: 'user explicitly said the prior answer was wrong / misunderstood' })
  }
  if (RE_UNDO.test(text)) {
    const strong = committedSomething(prev)
    out.push({ kind: 'user_undo', category: 'explicit', strength: strong ? 'gold' : 'silver',
      turnId: prev.turnId, sessionId: cur.sessionId, ...(strong ? { layerHint: 'state_commitment' as const } : {}),
      confidence: strong ? 0.85 : 0.6, polarity: 'failure',
      evidence: strong ? 'user undid an action right after a committed change' : 'user asked to undo/cancel' })
  }
  if (RE_SUCCESS.test(text)) {
    out.push({ kind: 'user_confirmation', category: 'explicit', strength: 'silver', turnId: prev.turnId,
      sessionId: cur.sessionId, confidence: 0.7, polarity: 'success',
      evidence: 'user positively confirmed the prior answer' })
  }
  return out
}

// ── Implicit signals (window-based, probabilistic) ───────────────────────────
export function detectImplicit(prev: AbuTraceEnvelope | undefined, cur: AbuTraceEnvelope): Signal[] {
  if (!prev) return []
  const out: Signal[] = []
  const sim = tokenSimilarity(prev.normalizedInput, cur.normalizedInput)
  // Immediate repeat/paraphrase of the same request → the prior answer probably missed.
  if (sim >= 0.6) {
    out.push({ kind: 'immediate_repeat', category: 'implicit', strength: 'silver', turnId: prev.turnId,
      sessionId: cur.sessionId, confidence: 0.55, polarity: 'failure',
      evidence: `user re-asked a near-identical request (sim=${sim.toFixed(2)})` })
  }
  // Modality switch after a similar request → user changed channel to get through.
  if (sim >= 0.4 && prev.modality !== cur.modality) {
    out.push({ kind: 'modality_switch_after_failure', category: 'implicit', strength: 'bronze',
      turnId: prev.turnId, sessionId: cur.sessionId, confidence: 0.35, polarity: 'failure',
      evidence: `user switched ${prev.modality}→${cur.modality} on a similar request` })
  }
  return out
}

/** Run every detector over a window (most-recent last). Returns all signals found
 *  for the newest turn (automatic on it, explicit/implicit judging its predecessor). */
export function detectSignals(window: AbuTraceEnvelope[]): Signal[] {
  if (!window.length) return []
  const cur = window[window.length - 1]!
  const prev = window[window.length - 2]
  return [...detectAutomatic(cur), ...detectExplicit(prev, cur), ...detectImplicit(prev, cur)]
}

/** GOLD/SILVER may open a case; BRONZE may only cluster (Section 7). */
export function mayDriveLearning(s: Signal): boolean { return s.strength === 'gold' || s.strength === 'silver' }
