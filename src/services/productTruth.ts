/**
 * PRODUCT TRUTH — the single, honest, operator-readable snapshot of what
 * AbuAI ACTUALLY did on the last turn. This is the anti-guessing surface:
 * Leo (and Martita) can see the real voice mode, whether Realtime connected
 * or silently fell back to the Web-Speech pipeline, which STT/TTS ran, the
 * calendar source of truth, and the last resolved person/gender/pronoun.
 *
 * Design rules:
 * - NO fabricated values. Every field is either (a) a build constant from
 *   version.ts, (b) live-set by the runtime via setProductTruth(), or
 *   (c) DERIVED from the real diagnostic stores (voiceDiagLog + productDiagnostics).
 * - Honest fallback: when Realtime does not connect, the report says so
 *   (REALTIME_STATUS=fallback, FALLBACK_USED=true, STT_PROVIDER=Web Speech).
 *   The fallback is never hidden here.
 * - Pure/​deterministic report builder so it can be unit-tested with no DOM.
 */

import { APP_VERSION } from '../version'
import { diagGetAll } from './productDiagnostics'
import { getLastVoiceTrace } from './voiceDiagLog'

export type VoiceMode = 'realtime' | 'pipeline' | 'text' | 'idle'
export type RealtimeStatus =
  | 'idle'
  | 'attempting'
  | 'connected'
  | 'listening'
  | 'speaking'
  | 'error'
  | 'fallback'
  | 'unavailable'

export interface ProductTruth {
  buildId: string
  commit: string
  buildDate: string
  branch: string
  voiceMode: VoiceMode
  realtimeStatus: RealtimeStatus
  sttProvider: string
  ttsProvider: string
  fallbackUsed: boolean
  latencyMs: number | null
  route: string
  calendarSource: string
  onlineUsed: boolean
  memoryUsed: boolean
  lastPerson: string | null
  lastGender: string | null
  lastPronoun: string | null
  lastError: string | null
  updatedAt: string | null
}

/**
 * The honest calendar-source truth: AbuAI persists appointments in this
 * device's local storage only. There is no live Google/Apple two-way sync.
 * Team 6 (Calendar Truth) requires this be stated plainly, not implied.
 */
export const CALENDAR_SOURCE_LOCAL = 'AbuCalendar — local device only (no Google/Apple sync)'

// Live fields the component knows in real time (Realtime state, latency, the
// last resolved person). Merged over the derived-from-store baseline.
let _live: Partial<ProductTruth> = {}

/** Live-set truth fields from the runtime. Stamps updatedAt. */
export function setProductTruth(fields: Partial<ProductTruth>): void {
  _live = { ..._live, ...fields }
  try {
    _live.updatedAt = new Date().toISOString()
  } catch {
    /* fake timers / no clock — leave prior */
  }
}

/** Test/reset hook — clears live overrides. */
export function resetProductTruth(): void {
  _live = {}
}

/**
 * Resolve and record the last person the runtime answered about, deriving
 * gender + the natural Hebrew pronoun from the family graph (deterministic,
 * data-derived — the LLM cannot override it). Martita herself is always
 * female. Pass the Hebrew name (route.familyQuery / resolvePronouns person).
 */
export function recordLastPerson(
  name: string | null | undefined,
  graph: ReadonlyArray<{ hebrew: string; gender?: string }>,
): void {
  if (!name) return
  const node = graph.find(n => n.hebrew === name)
  const gender = node?.gender ?? null
  const pronoun =
    gender === 'female' ? 'היא / עליה' : gender === 'male' ? 'הוא / עליו' : null
  setProductTruth({ lastPerson: name, lastGender: gender, lastPronoun: pronoun })
}

function pickStt(live?: string, traceStt?: string | null, diagStt?: string): string {
  return live ?? diagStt ?? (traceStt && traceStt !== 'none' ? traceStt : null) ?? 'n/a'
}

/**
 * The single source of truth for the dashboard. Merges, in priority order:
 *   1. live-set fields (setProductTruth)
 *   2. the last productDiagnostics entry (STT/TTS/route/calendar/gender)
 *   3. the last voiceDiagLog trace (route/providers/error)
 *   4. build constants
 * Never invents a value — unknown fields read 'n/a' / false / null.
 */
export function getProductTruth(): ProductTruth {
  const diag = diagGetAll()
  const d = diag.length ? diag[diag.length - 1]! : undefined
  const t = getLastVoiceTrace()

  const route = _live.route ?? d?.routeDecision ?? t?.route ?? 'n/a'
  const responseSource = d?.responseSource ?? ''
  const onlineUsed =
    _live.onlineUsed ??
    (/online|web|search/i.test(responseSource) || /online|weather|news/i.test(route))
  const memoryUsed =
    _live.memoryUsed ?? /conversation_os|memory|recall/i.test(responseSource)

  // Fallback truth: explicit live flag, else inferred from a non-Realtime STT.
  const sttProvider = pickStt(_live.sttProvider, t?.sttProvider, d?.sttProvider)
  const inferredFallback = /web ?speech|whisper|groq|pipeline/i.test(sttProvider)
  const fallbackUsed = _live.fallbackUsed ?? (d?.ttsFallback ?? inferredFallback)

  const realtimeStatus: RealtimeStatus = _live.realtimeStatus ?? 'idle'
  const voiceMode: VoiceMode =
    _live.voiceMode ??
    (realtimeStatus === 'listening' || realtimeStatus === 'speaking' || realtimeStatus === 'connected'
      ? 'realtime'
      : sttProvider !== 'n/a'
        ? (fallbackUsed ? 'pipeline' : 'text')
        : 'idle')

  return {
    buildId: APP_VERSION.version,
    commit: APP_VERSION.commitHint,
    buildDate: APP_VERSION.buildDate,
    branch: APP_VERSION.branchHint,
    voiceMode,
    realtimeStatus,
    sttProvider,
    ttsProvider: _live.ttsProvider ?? d?.ttsProvider ?? t?.ttsProvider ?? 'n/a',
    fallbackUsed,
    latencyMs: _live.latencyMs ?? d?.ttsLatencyMs ?? null,
    route,
    calendarSource:
      _live.calendarSource ??
      (d?.calendarSource && d.calendarSource !== 'n/a'
        ? CALENDAR_SOURCE_LOCAL
        : CALENDAR_SOURCE_LOCAL),
    onlineUsed,
    memoryUsed,
    lastPerson: _live.lastPerson ?? (d?.genderDebug?.startsWith('family: ') ? d.genderDebug.slice(8) : null),
    lastGender: _live.lastGender ?? null,
    lastPronoun: _live.lastPronoun ?? null,
    lastError: _live.lastError ?? t?.error ?? t?.llmError ?? t?.sttError ?? null,
    updatedAt: _live.updatedAt ?? d?.ts ?? t?.ts ?? null,
  }
}

/** The copyable PRODUCT TRUTH REPORT — exact field names Leo asked for. */
export function formatProductTruthReport(now?: string): string {
  const p = getProductTruth()
  const yn = (b: boolean) => (b ? 'YES' : 'NO')
  return [
    '=== ABUAI PRODUCT TRUTH REPORT ===',
    now ? `GENERATED:       ${now}` : null,
    `BUILD_ID:        ${p.buildId}`,
    `COMMIT:          ${p.commit}`,
    `BUILD_DATE:      ${p.buildDate}`,
    `BRANCH:          ${p.branch}`,
    '--- VOICE ---',
    `VOICE_MODE:      ${p.voiceMode}`,
    `REALTIME_STATUS: ${p.realtimeStatus}`,
    `STT_PROVIDER:    ${p.sttProvider}`,
    `TTS_PROVIDER:    ${p.ttsProvider}`,
    `FALLBACK_USED:   ${yn(p.fallbackUsed)}`,
    `LATENCY_MS:      ${p.latencyMs ?? 'n/a'}`,
    '--- LAST TURN ---',
    `ROUTE:           ${p.route}`,
    `CALENDAR_SOURCE: ${p.calendarSource}`,
    `ONLINE_USED:     ${yn(p.onlineUsed)}`,
    `MEMORY_USED:     ${yn(p.memoryUsed)}`,
    `LAST_PERSON:     ${p.lastPerson ?? 'n/a'}`,
    `LAST_GENDER:     ${p.lastGender ?? 'n/a'}`,
    `LAST_PRONOUN:    ${p.lastPronoun ?? 'n/a'}`,
    `LAST_ERROR:      ${p.lastError ?? 'none'}`,
    `UPDATED_AT:      ${p.updatedAt ?? 'never'}`,
    '=== END REPORT ===',
  ]
    .filter(Boolean)
    .join('\n')
}
