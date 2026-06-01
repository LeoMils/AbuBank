/*
 * VoiceDebugPanel — operator-only QA diagnostic for the live voice flow.
 *
 * Renders ONLY when localStorage['abu-voice-debug'] === 'true'. Hidden by
 * default. Surfaces the fields a mic-QA operator needs to verify the text
 * pipeline end-to-end: raw, normalized, route, intent, date, time,
 * relation, person, saveAllowed, reason.
 *
 * The toggle button and the panel share state through a tiny in-module
 * event bus so a click on the toggle re-renders the panel even though
 * they are sibling components in the React tree.
 *
 * Never shows for Martita. Never exposes raw transcripts in the normal flow.
 */

import { useEffect, useState, useCallback } from 'react'
import type { VoiceTrace } from './voiceTrace'
import type { ReminderDraft } from './reminders/types'
import type { QaRun } from './diagnostics/qaRunTypes'

export const VOICE_DEBUG_LOCALSTORAGE_KEY = 'abu-voice-debug'

// ─── In-module event bus ──────────────────────────────────────────────
// The toggle and panel are siblings under the calendar root. When the
// toggle flips localStorage, React would not normally re-render the
// panel — they share no parent state. This subscriber set fixes that
// without lifting the flag into AbuCalendar's render path.
type Listener = () => void
const listeners = new Set<Listener>()
function notifyDebugChanged() { listeners.forEach(l => l()) }

export function isVoiceDebugEnabled(): boolean {
  try {
    return typeof localStorage !== 'undefined'
      && localStorage.getItem(VOICE_DEBUG_LOCALSTORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setVoiceDebugEnabled(next: boolean): void {
  try {
    if (next) localStorage.setItem(VOICE_DEBUG_LOCALSTORAGE_KEY, 'true')
    else localStorage.removeItem(VOICE_DEBUG_LOCALSTORAGE_KEY)
  } catch { /* ignore */ }
  notifyDebugChanged()
}

function useVoiceDebugEnabled(): boolean {
  const [on, setOn] = useState<boolean>(isVoiceDebugEnabled())
  useEffect(() => {
    const update = () => setOn(isVoiceDebugEnabled())
    listeners.add(update)
    return () => { listeners.delete(update) }
  }, [])
  return on
}

/**
 * Dev-only QA toggle. Renders as a real <button> so screen readers and
 * pointer events both work. Shows current state explicitly: "QA OFF" or
 * "QA ON". Production builds (import.meta.env.DEV === false) render null.
 */
export function VoiceDebugToggle() {
  if (!import.meta.env.DEV) return null
  const on = useVoiceDebugEnabled()
  return (
    <button
      type="button"
      data-testid="voice-debug-toggle"
      data-qa-state={on ? 'on' : 'off'}
      aria-label={on ? 'turn mic QA debug off' : 'turn mic QA debug on'}
      aria-pressed={on}
      onClick={() => setVoiceDebugEnabled(!on)}
      style={{
        position: 'fixed',
        bottom: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        padding: '4px 12px',
        fontSize: 11,
        fontFamily: 'monospace',
        fontWeight: 700,
        letterSpacing: 0.5,
        color: on ? '#0B0F1F' : 'rgba(232,199,106,0.85)',
        background: on ? 'rgba(232,199,106,0.92)' : 'rgba(8,12,24,0.75)',
        border: '1px solid rgba(201,168,76,0.55)',
        borderRadius: 8,
        cursor: 'pointer',
        userSelect: 'none',
        boxShadow: on
          ? '0 2px 10px rgba(232,199,106,0.30)'
          : '0 2px 6px rgba(0,0,0,0.35)',
      }}
    >{on ? 'QA ON' : 'QA OFF'}</button>
  )
}

interface Props {
  trace: VoiceTrace | null
  reminderDraft?: ReminderDraft | null
}

export function VoiceDebugPanel({ trace, reminderDraft }: Props) {
  const enabled = useVoiceDebugEnabled()
  if (!enabled) return null
  if (!trace && !reminderDraft) return null

  const raw = trace?.rawTranscript ?? null
  const normalized = trace?.transcript ?? trace?.correctedTranscript ?? null
  // Route is the canonical semantic action — never a UI action like
  // "show_confirm_card". Falls back to "unknown" rather than leaking
  // parseDecision into the route field.
  const route = trace?.semanticRoute ?? (reminderDraft ? 'reminder_create' : 'unknown')
  const intent = trace?.semanticIntent || null
  const date = reminderDraft?.displayDateLabel ?? trace?.extractedDate ?? null
  const time = reminderDraft?.displayTimeLabel ?? trace?.extractedStartTime ?? null
  const relation = reminderDraft?.familyResolution?.originalPhrase
    ?? trace?.relationPhrase
    ?? null
  // When a relation phrase IS extracted, the person field must be
  // honest: either the resolved name OR "—" (unresolved). Falling back
  // to extractedPeople here would surface name fragments like "אבא"
  // and contradict the relation/resolvedPerson story.
  const person = reminderDraft?.familyResolution?.resolvedName
    ?? trace?.resolvedPersonName
    ?? (relation
        ? null
        : (trace?.extractedPeople && trace.extractedPeople.length > 0
            ? trace.extractedPeople.join(', ')
            : null))
  const finalTitle = trace?.finalTitle ?? reminderDraft?.title ?? null

  // Save-allowed comes from the trace (written by index.tsx alongside
  // the same decision that drives the card), so panel and card never
  // disagree on save reachability.
  let saveAllowed: 'yes' | 'no' = trace?.saveAllowed ? 'yes' : 'no'
  let reason: string = trace?.saveBlockReason ?? (trace?.saveAllowed ? 'ok' : '—')
  if (reminderDraft) {
    const fr = reminderDraft.familyResolution
    if (reminderDraft.ambiguity) { saveAllowed = 'no'; reason = 'ambiguity unresolved' }
    else if (reminderDraft.missingFields?.includes('title')) { saveAllowed = 'no'; reason = 'missing title' }
    else if (!reminderDraft.dueAt) { saveAllowed = 'no'; reason = 'missing dueAt' }
    else if (fr?.status === 'ambiguous') { saveAllowed = 'no'; reason = 'family ambiguous' }
    else { saveAllowed = 'yes'; reason = 'ok' }
  }

  return (
    <div
      data-testid="mic-qa-trace"
      dir="ltr"
      style={{
        position: 'fixed',
        bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
        left: 8,
        zIndex: 9998,
        maxWidth: 340,
        padding: '10px 12px',
        borderRadius: 10,
        background: 'rgba(8,12,24,0.94)',
        border: '1px solid rgba(201,168,76,0.40)',
        color: 'rgba(255,255,255,0.92)',
        fontFamily: 'monospace',
        fontSize: 11,
        lineHeight: 1.5,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        userSelect: 'text',
      }}
    >
      <div style={{ fontWeight: 700, color: '#E8C76A', marginBottom: 4 }}>
        MIC QA TRACE
      </div>
      <div data-testid="mic-qa-raw">raw: {raw ?? '—'}</div>
      <div data-testid="mic-qa-normalized">norm: {normalized ?? '—'}</div>
      <div data-testid="mic-qa-route">route: {route ?? '—'}</div>
      <div data-testid="mic-qa-intent">intent: {intent ?? '—'}</div>
      <div data-testid="mic-qa-date">date: {date ?? '—'}</div>
      <div data-testid="mic-qa-time">time: {time ?? '—'}</div>
      <div data-testid="mic-qa-relation">relation: {relation ?? '—'}</div>
      <div data-testid="mic-qa-person">person: {person ?? '—'}</div>
      <div data-testid="mic-qa-final-title">finalTitle: {finalTitle ?? '—'}</div>
      <div data-testid="mic-qa-save-allowed">saveAllowed: {saveAllowed}</div>
      <div data-testid="mic-qa-reason">reason: {reason}</div>
    </div>
  )
}

// ─── QA Run Recorder ─────────────────────────────────────────────────
// Persists every voice attempt as a QaRun in localStorage.
// Dev-only. Hidden unless QA ON.

const QA_RUNS_KEY = 'abu-calendar-qa-runs'
const MAX_QA_RUNS = 100

function loadQaRuns(): QaRun[] {
  try {
    const raw = localStorage.getItem(QA_RUNS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as QaRun[]
  } catch { return [] }
}

function saveQaRuns(runs: QaRun[]): void {
  try {
    const trimmed = runs.slice(-MAX_QA_RUNS)
    localStorage.setItem(QA_RUNS_KEY, JSON.stringify(trimmed))
  } catch { /* ignore */ }
}

/** Build a QaRun from the current trace + reminderDraft. Call this
 *  after every voice pipeline completion (success, error, or blocked). */
export function buildQaRunFromTrace(trace: VoiceTrace, reminderDraft: ReminderDraft | null | undefined, appVersion: string): QaRun {
  const fr = reminderDraft?.familyResolution
  const route = trace.semanticRoute ?? (reminderDraft ? 'reminder_create' : 'unknown')
  let runSaveAllowed = trace.saveAllowed
  let runSaveBlockReason = trace.saveBlockReason ?? null
  if (reminderDraft) {
    if (reminderDraft.ambiguity) { runSaveAllowed = false; runSaveBlockReason = 'ambiguity' }
    else if (reminderDraft.missingFields?.includes('title')) { runSaveAllowed = false; runSaveBlockReason = 'missing title' }
    else if (!reminderDraft.dueAt) { runSaveAllowed = false; runSaveBlockReason = 'missing dueAt' }
    else if (fr?.status === 'ambiguous') { runSaveAllowed = false; runSaveBlockReason = 'family ambiguous' }
    else { runSaveAllowed = true; runSaveBlockReason = null }
  }

  return {
    id: `qa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    appVersion,
    rawTranscript: trace.rawTranscript,
    normalizedTranscript: trace.transcript ?? trace.correctedTranscript,
    semanticRoute: route,
    intent: trace.semanticIntent,
    date: reminderDraft?.displayDateLabel ?? trace.extractedDate ?? null,
    time: reminderDraft?.displayTimeLabel ?? trace.extractedStartTime ?? null,
    relationPhrase: fr?.originalPhrase ?? trace.relationPhrase ?? null,
    resolvedPersonName: fr?.resolvedName ?? trace.resolvedPersonName ?? null,
    resolvedPersonStatus: fr?.status ?? trace.resolvedPersonStatus ?? null,
    finalTitle: trace.finalTitle ?? reminderDraft?.title ?? null,
    confirmationText: null,
    saveAllowed: runSaveAllowed,
    saveBlockReason: runSaveBlockReason,
    cardState: trace.finalVoiceStage,
    cardTitle: null, cardMainText: null, cardSecondaryText: null, cardActions: null,
    audioDurationMs: trace.audioDurationMs ?? null,
    blobSize: trace.blobSize ?? null,
    chunksCount: trace.chunksCount ?? null,
    mimeType: trace.mimeType ?? null,
    stopReason: trace.stopReason ?? null,
    sttStatus: trace.sttStatus ?? null,
    transcriptLength: trace.transcriptLength ?? null,
    normalizedLength: trace.transcript?.length ?? null,
    noSpeechProb: trace.noSpeechProb ?? null,
    avgLogprob: trace.avgLogprob ?? null,
    compressionRatio: trace.compressionRatio ?? null,
    errorStep: trace.error ?? null,
    comparisonResult: 'pending',
  }
}

export function appendQaRun(run: QaRun): void {
  const runs = loadQaRuns()
  runs.push(run)
  saveQaRuns(runs)
  notifyDebugChanged()
}

function copyToClipboard(text: string): void {
  try {
    navigator.clipboard.writeText(text).catch(() => {
      window.prompt('העתיקי:', text)
    })
  } catch {
    window.prompt('העתיקי:', text)
  }
}

/** Dev-only QA recorder panel — shows run count + action buttons. */
export function QaRecorderPanel() {
  if (!import.meta.env.DEV) return null
  const enabled = useVoiceDebugEnabled()
  const [runs, setRuns] = useState<QaRun[]>([])

  const refresh = useCallback(() => { setRuns(loadQaRuns()) }, [])
  useEffect(() => {
    refresh()
    listeners.add(refresh)
    return () => { listeners.delete(refresh) }
  }, [refresh])

  if (!enabled) return null

  const last = runs.length > 0 ? runs[runs.length - 1]! : null

  function handleClear() { saveQaRuns([]); refresh() }
  function handleCopyLast() { if (last) copyToClipboard(JSON.stringify(last, null, 2)) }
  function handleCopyAll() { copyToClipboard(JSON.stringify(runs, null, 2)) }
  function handleMarkLast(result: 'pass' | 'fail') {
    if (!last) return
    last.comparisonResult = result
    saveQaRuns(runs)
    refresh()
  }

  const btnStyle: React.CSSProperties = {
    padding: '4px 8px', fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
    border: '1px solid rgba(201,168,76,0.40)', borderRadius: 6,
    background: 'rgba(201,168,76,0.10)', color: '#E8C76A', cursor: 'pointer',
  }

  return (
    <div
      data-testid="qa-recorder-panel"
      dir="ltr"
      style={{
        position: 'fixed',
        bottom: 'calc(30px + env(safe-area-inset-bottom, 0px))',
        right: 8,
        zIndex: 9999,
        padding: '8px 10px',
        borderRadius: 10,
        background: 'rgba(8,12,24,0.94)',
        border: '1px solid rgba(201,168,76,0.40)',
        color: 'rgba(255,255,255,0.92)',
        fontFamily: 'monospace',
        fontSize: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ fontWeight: 700, color: '#E8C76A', marginBottom: 4 }}>
        QA RECORDER ({runs.length})
        {last?.comparisonResult === 'pass' && <span style={{ color: '#4ade80' }}> LAST:PASS</span>}
        {last?.comparisonResult === 'fail' && <span style={{ color: '#f87171' }}> LAST:FAIL</span>}
        {last?.comparisonResult === 'pending' && <span style={{ color: '#fbbf24' }}> LAST:?</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
        <button type="button" data-testid="qa-clear" onClick={handleClear} style={btnStyle}>Clear</button>
        <button type="button" data-testid="qa-copy-last" onClick={handleCopyLast} style={btnStyle}>Copy Last</button>
        <button type="button" data-testid="qa-copy-all" onClick={handleCopyAll} style={btnStyle}>Copy All JSON</button>
        <button type="button" data-testid="qa-mark-pass" onClick={() => handleMarkLast('pass')} style={{ ...btnStyle, color: '#4ade80', borderColor: '#4ade80' }}>PASS</button>
        <button type="button" data-testid="qa-mark-fail" onClick={() => handleMarkLast('fail')} style={{ ...btnStyle, color: '#f87171', borderColor: '#f87171' }}>FAIL</button>
      </div>
    </div>
  )
}
