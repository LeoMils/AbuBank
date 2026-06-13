/*
 * Production voice trace — captures the full execution path.
 *
 * Stores last 20 traces in localStorage. Exposed via "Copy Last Voice Trace"
 * button in AbuAI UI (always visible, not dev-only).
 */

import { APP_VERSION } from '../version'

export interface VoiceTrace {
  ts: string
  ver: string
  // STT
  sttProvider: 'groq' | 'none' | 'error'
  sttError: string | null
  rawTranscript: string | null
  // Routing
  route: string
  groundedAnswerUsed: boolean
  groundedAnswer: string | null
  // Calendar
  calendarAction: 'read' | 'create_draft' | 'save' | 'cancel' | 'none'
  calendarStorageWrite: boolean
  calendarStorageRead: boolean
  // LLM (if grounded answer not used)
  llmProvider: 'openai-server' | 'gemini-client' | 'groq-client' | 'none' | 'fallback'
  llmError: string | null
  // TTS
  ttsProvider: 'openai' | 'gemini' | 'silent' | 'none'
  ttsError: string | null
  // Final
  finalResponse: string | null
  error: string | null
}

const DIAG_KEY = 'abu-voice-trace'
const MAX_ENTRIES = 20

let _current: Partial<VoiceTrace> = {}

/** Start a new trace. Call at the beginning of every voice/text turn. */
export function traceStart(): void {
  _current = { ts: new Date().toISOString(), ver: APP_VERSION.version }
}

/** Add fields to the current trace. */
export function traceSet(fields: Partial<VoiceTrace>): void {
  Object.assign(_current, fields)
}

/** Finalize and persist the current trace. */
export function traceEnd(): void {
  try {
    const raw = localStorage.getItem(DIAG_KEY)
    const entries: VoiceTrace[] = raw ? JSON.parse(raw) : []
    entries.push({
      ts: _current.ts ?? new Date().toISOString(),
      ver: _current.ver ?? APP_VERSION.version,
      sttProvider: _current.sttProvider ?? 'none',
      sttError: _current.sttError ?? null,
      rawTranscript: _current.rawTranscript ?? null,
      route: _current.route ?? 'unknown',
      groundedAnswerUsed: _current.groundedAnswerUsed ?? false,
      groundedAnswer: _current.groundedAnswer ?? null,
      calendarAction: _current.calendarAction ?? 'none',
      calendarStorageWrite: _current.calendarStorageWrite ?? false,
      calendarStorageRead: _current.calendarStorageRead ?? false,
      llmProvider: _current.llmProvider ?? 'none',
      llmError: _current.llmError ?? null,
      ttsProvider: _current.ttsProvider ?? 'none',
      ttsError: _current.ttsError ?? null,
      finalResponse: _current.finalResponse?.slice(0, 200) ?? null,
      error: _current.error ?? null,
    })
    localStorage.setItem(DIAG_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch { /* silent */ }
  _current = {}
}

/** Get last trace as copyable text. */
export function getLastTraceText(): string {
  try {
    const raw = localStorage.getItem(DIAG_KEY)
    if (!raw) return 'אין נתוני קול.'
    const entries: VoiceTrace[] = JSON.parse(raw)
    if (entries.length === 0) return 'אין נתוני קול.'
    const e = entries[entries.length - 1]!
    return [
      `AbuAI Voice Trace — ${e.ts}`,
      `version: ${e.ver}`,
      `── STT ──`,
      `provider: ${e.sttProvider}`,
      e.sttError ? `error: ${e.sttError}` : null,
      `transcript: "${e.rawTranscript ?? '(none)'}"`,
      `── Route ──`,
      `route: ${e.route}`,
      `grounded: ${e.groundedAnswerUsed ? 'YES' : 'NO'}`,
      e.groundedAnswer ? `answer: "${e.groundedAnswer.slice(0, 100)}"` : null,
      `── Calendar ──`,
      `action: ${e.calendarAction}`,
      `storage read: ${e.calendarStorageRead}`,
      `storage write: ${e.calendarStorageWrite}`,
      `── LLM ──`,
      `provider: ${e.llmProvider}`,
      e.llmError ? `error: ${e.llmError}` : null,
      `── TTS ──`,
      `provider: ${e.ttsProvider}`,
      e.ttsError ? `error: ${e.ttsError}` : null,
      `── Response ──`,
      `"${e.finalResponse ?? '(none)'}"`,
      e.error ? `── ERROR: ${e.error} ──` : null,
    ].filter(Boolean).join('\n')
  } catch {
    return 'שגיאה בקריאת נתונים.'
  }
}

/** Get full report of all traces. */
export function getAllTracesText(): string {
  try {
    const raw = localStorage.getItem(DIAG_KEY)
    if (!raw) return 'אין נתוני קול.'
    const entries: VoiceTrace[] = JSON.parse(raw)
    return entries.map((e, i) => {
      return `#${i + 1} [${e.ts}] STT:${e.sttProvider} route:${e.route} grounded:${e.groundedAnswerUsed} cal:${e.calendarAction} llm:${e.llmProvider} tts:${e.ttsProvider}${e.error ? ' ERR:' + e.error : ''}\n  "${e.rawTranscript ?? '-'}" → "${(e.finalResponse ?? '-').slice(0, 80)}"`
    }).join('\n\n')
  } catch {
    return 'שגיאה.'
  }
}
