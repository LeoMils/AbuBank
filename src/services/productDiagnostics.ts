/**
 * AbuAI Product Diagnostics — runtime trace for iPhone debugging.
 *
 * Captures the full pipeline for every voice interaction:
 * STT → route → response source → spoken rewrite → TTS provider
 *
 * Stored in localStorage, readable via one-tap Copy Diagnostics button.
 */

export interface PipelineEntry {
  ts: string
  // STT
  sttProvider: string        // 'WebSpeech' | 'Groq Whisper' | 'OpenAI Whisper' | 'text-input'
  sttFileType: string        // 'webm' | 'mp4' | 'n/a'
  sttTranscript: string
  sttStatus: string
  // Routing
  routeDecision: string      // 'greeting' | 'family_lookup' | 'calendar_today' | 'non_personal' | etc.
  responseSource: string     // 'grounded' | 'grounded+LLM' | 'proactive' | 'LLM stream' | 'online'
  // Response
  rawResponse: string
  spokenResponse: string
  // TTS
  ttsProvider: string        // 'OpenAI' | 'Gemini' | 'NONE'
  ttsModel: string
  ttsVoice: string
  ttsLatencyMs: number
  ttsStatus: string
  ttsFallback: boolean
  // Gender
  genderDebug: string        // 'family: מור=female' | 'n/a'
  // Calendar
  calendarSource: string     // 'localStorage' | 'none'
}

const DIAG_KEY = 'abu-product-diagnostics'
const MAX_ENTRIES = 20

let _currentEntry: Partial<PipelineEntry> = {}

export function diagReset() {
  _currentEntry = { ts: new Date().toISOString() }
}

export function diagSet(fields: Partial<PipelineEntry>) {
  Object.assign(_currentEntry, fields)
}

export function diagCommit() {
  try {
    const history = JSON.parse(localStorage.getItem(DIAG_KEY) || '[]') as PipelineEntry[]
    history.push(_currentEntry as PipelineEntry)
    if (history.length > MAX_ENTRIES) history.splice(0, history.length - MAX_ENTRIES)
    localStorage.setItem(DIAG_KEY, JSON.stringify(history))
  } catch {}
  _currentEntry = {}
}

export function diagGetAll(): PipelineEntry[] {
  try { return JSON.parse(localStorage.getItem(DIAG_KEY) || '[]') } catch { return [] }
}

export function diagCopyText(): string {
  const entries = diagGetAll()
  if (entries.length === 0) return 'No diagnostics yet. Speak first.'

  const lines = entries.map((e, i) => {
    return [
      `--- Turn ${i + 1} (${e.ts?.split('T')[1]?.slice(0, 8) ?? '?'}) ---`,
      `STT: ${e.sttProvider ?? '?'} | ${e.sttFileType ?? '?'} | "${e.sttTranscript?.slice(0, 50) ?? '?'}" | ${e.sttStatus ?? '?'}`,
      `Route: ${e.routeDecision ?? '?'} | Source: ${e.responseSource ?? '?'}`,
      `Raw: "${e.rawResponse?.slice(0, 80) ?? '?'}"`,
      `Spoken: "${e.spokenResponse?.slice(0, 80) ?? '?'}"`,
      `TTS: ${e.ttsProvider ?? '?'} | ${e.ttsModel ?? '?'} | ${e.ttsVoice ?? '?'} | ${e.ttsLatencyMs ?? '?'}ms | ${e.ttsStatus ?? '?'} | fallback=${e.ttsFallback ?? '?'}`,
      `Gender: ${e.genderDebug ?? 'n/a'}`,
      `Calendar: ${e.calendarSource ?? 'n/a'}`,
    ].join('\n')
  })

  return `AbuAI Product Diagnostics (${entries.length} turns)\n\n${lines.join('\n\n')}`
}
