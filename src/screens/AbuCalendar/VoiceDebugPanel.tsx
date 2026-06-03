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
import { RELEASE_CANDIDATE_EXPECTATIONS } from './diagnostics/releaseCandidateExpectations'

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
      {/* Mic startup diagnostics — show error details when recording fails */}
      {trace?.error && (
        <div data-testid="mic-qa-error" style={{ marginTop: 6, padding: '4px 6px', borderRadius: 4, background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.25)', whiteSpace: 'pre-wrap', fontSize: 10, color: '#fca5a5' }}>
          {trace.error}
        </div>
      )}
    </div>
  )
}

// ─── Mic Self-Test ───────────────────────────────────────────────────
// Standalone diagnostic that tests each step of the recording pipeline.

export function MicSelfTest() {
  if (!import.meta.env.DEV) return null
  const enabled = useVoiceDebugEnabled()
  const [result, setResult] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [open, setOpen] = useState(false)

  if (!enabled) return null

  if (!open) {
    return (
      <button type="button" data-testid="mic-self-test-trigger" onClick={() => { setOpen(true); void doRunTest() }} style={{
        position: 'fixed', top: 8, left: 8, zIndex: 10002,
        padding: '4px 10px', fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
        border: '1px solid rgba(96,165,250,0.50)', borderRadius: 6,
        background: 'rgba(96,165,250,0.10)', color: '#60a5fa', cursor: 'pointer',
      }}>Mic Test</button>
    )
  }

  async function doRunTest() { setRunning(true); await runTest(); setRunning(false) }

  async function runTest() {
    setRunning(true)
    const lines: string[] = []
    const log = (s: string) => { lines.push(s); setResult(lines.join('\n')) }

    // 1. Secure context
    log(`secureContext: ${window.isSecureContext}`)
    log(`protocol: ${window.location.protocol}`)

    // 2. getUserMedia available
    log(`mediaDevices: ${!!navigator.mediaDevices}`)
    log(`getUserMedia: ${!!(navigator.mediaDevices?.getUserMedia)}`)

    // 3. MediaRecorder available
    log(`MediaRecorder: ${typeof MediaRecorder !== 'undefined'}`)

    // 4. Enumerate devices
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const mics = devices.filter(d => d.kind === 'audioinput')
      log(`micCount: ${mics.length}`)
    } catch (e) { log(`enumerateDevices: ERROR ${e instanceof Error ? e.name : e}`) }

    // 5. getUserMedia with constraints
    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      log('getUserMedia(constraints): OK')
    } catch (e) {
      const name = e instanceof Error ? e.name : 'unknown'
      log(`getUserMedia(constraints): FAIL ${name}`)
      // Fallback
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        log('getUserMedia(bare): OK (fallback)')
      } catch (e2) {
        log(`getUserMedia(bare): FAIL ${e2 instanceof Error ? e2.name : e2}`)
        setRunning(false)
        return
      }
    }

    // 6. Supported MIME
    const types = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
    const supported = types.filter(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t))
    log(`supportedMime: ${supported.join(', ') || 'none (default)'}`)

    // 7. Create MediaRecorder
    let mr: MediaRecorder
    try {
      mr = supported.length > 0 ? new MediaRecorder(stream, { mimeType: supported[0]! }) : new MediaRecorder(stream)
      log(`MediaRecorder created: ${mr.mimeType || 'default'}`)
    } catch (e) {
      log(`MediaRecorder: FAIL ${e instanceof Error ? e.name : e}`)
      stream.getTracks().forEach(t => t.stop())
      setRunning(false)
      return
    }

    // 8. Start with timeslice
    const chunks: Blob[] = []
    mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    try {
      mr.start(250)
      log('start(250): OK')
    } catch {
      try { mr.start(); log('start(): OK (no timeslice)') } catch (e) {
        log(`start: FAIL ${e instanceof Error ? e.name : e}`)
        stream.getTracks().forEach(t => t.stop())
        setRunning(false)
        return
      }
    }

    // 9. Record for 1.5s then stop
    await new Promise(resolve => setTimeout(resolve, 1500))
    try { mr.stop(); log('stop: OK') } catch (e) { log(`stop: FAIL ${e instanceof Error ? e.name : e}`) }

    // Wait for onstop
    await new Promise(resolve => { mr.onstop = resolve; setTimeout(resolve, 2000) })
    stream.getTracks().forEach(t => t.stop())

    log(`chunks: ${chunks.length}`)
    const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' })
    log(`blobSize: ${blob.size}`)
    log(`blobType: ${blob.type}`)
    log(blob.size > 1000 ? 'RESULT: MIC OK' : 'RESULT: MIC PROBLEM — blob too small')
    setRunning(false)
  }

  return (
    <div data-testid="mic-self-test" style={{
      position: 'fixed', top: 'calc(50% - 120px)', left: 8, right: 8, zIndex: 10002,
      padding: '12px', borderRadius: 12,
      background: 'rgba(8,12,24,0.97)', border: '1.5px solid rgba(96,165,250,0.50)',
      fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.90)',
      lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: '50vh', overflow: 'auto',
      boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
    }}>
      <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>MIC SELF-TEST</div>
      {running ? 'Running...' : result ?? 'Starting...'}
      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <button type="button" data-testid="mic-self-test-rerun" onClick={() => void doRunTest()} disabled={running} style={{
          padding: '6px 12px', fontSize: 11, fontFamily: 'monospace',
          border: '1px solid rgba(96,165,250,0.4)', borderRadius: 6,
          background: 'rgba(96,165,250,0.1)', color: '#60a5fa', cursor: running ? 'wait' : 'pointer',
        }}>Rerun</button>
        <button type="button" data-testid="mic-self-test-close" onClick={() => { setOpen(false); setResult(null) }} style={{
          padding: '6px 12px', fontSize: 11, fontFamily: 'monospace',
          border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6,
          background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
        }}>Close</button>
      </div>
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

// Guided QA: track which expectation the operator is currently testing.
let _currentExpectedId: string | null = null
let _currentExpectedUtterance: string | null = null
export function setCurrentExpected(id: string | null, utterance: string | null): void {
  _currentExpectedId = id
  _currentExpectedUtterance = utterance
}
export function getCurrentExpectedId(): string | null { return _currentExpectedId }

export function appendQaRun(run: QaRun): void {
  // Attach the guided QA expectation if active
  if (_currentExpectedId) {
    run.expectedId = _currentExpectedId
    if (_currentExpectedUtterance) run.expectedUtterance = _currentExpectedUtterance
  }
  const runs = loadQaRuns()
  runs.push(run)
  saveQaRuns(runs)
  notifyDebugChanged()
  // Auto-upload to dev server (non-blocking)
  void sendQaRunsToDevServer(runs)
}

// ─── Auto-save to dev server ─────────────────────────────────────────
// POSTs all QA runs to /__abu_calendar_qa_log on the Vite dev server.
// Server writes to tmp/abu-calendar-qa/latest.json. No clipboard needed.

export type QaUploadStatus = 'idle' | 'uploading' | 'saved' | 'failed'
let _qaUploadStatus: QaUploadStatus = 'idle'
let _qaLastSavedAt: string | null = null
let _qaLastServerPath: string | null = null
let _qaLastUploadError: string | null = null
export function getQaUploadStatus() {
  return { status: _qaUploadStatus, lastSavedAt: _qaLastSavedAt, serverPath: _qaLastServerPath, error: _qaLastUploadError }
}

export async function sendQaRunsToDevServer(runs: QaRun[]): Promise<boolean> {
  if (!import.meta.env.DEV) return false
  _qaUploadStatus = 'uploading'
  _qaLastUploadError = null
  notifyDebugChanged()
  try {
    const res = await fetch('/__abu_calendar_qa_log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runs, createdAt: new Date().toISOString(), appVersion: runs[0]?.appVersion ?? 'unknown' }),
    })
    const data = await res.json() as { ok: boolean; path?: string; count?: number; error?: string }
    if (data.ok) {
      _qaUploadStatus = 'saved'
      _qaLastSavedAt = new Date().toISOString()
      _qaLastServerPath = data.path ?? null
      notifyDebugChanged()
      return true
    }
    _qaUploadStatus = 'failed'
    _qaLastUploadError = data.error ?? 'unknown'
    notifyDebugChanged()
    return false
  } catch (e) {
    _qaUploadStatus = 'failed'
    _qaLastUploadError = e instanceof Error ? e.message : String(e)
    notifyDebugChanged()
    return false
  }
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

/** Dev-only QA recorder panel — shows run count + action buttons.
 *  Hidden while Guided QA is active to avoid covering the mic/actions. */
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

  if (!enabled || _guidedQaActive) return null

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
      {/* Auto-save status */}
      <div data-testid="qa-upload-status" style={{
        fontSize: 9, marginTop: 4, padding: '2px 4px', borderRadius: 4,
        color: _qaUploadStatus === 'saved' ? '#4ade80' : _qaUploadStatus === 'failed' ? '#f87171' : 'rgba(255,255,255,0.4)',
        background: _qaUploadStatus === 'saved' ? 'rgba(74,222,128,0.08)' : _qaUploadStatus === 'failed' ? 'rgba(248,113,113,0.08)' : 'transparent',
      }}>
        {_qaUploadStatus === 'saved' && `נשמר למחשב ${_qaLastSavedAt?.slice(11, 19) ?? ''}`}
        {_qaUploadStatus === 'failed' && `שמירה למחשב נכשלה: ${_qaLastUploadError?.slice(0, 30) ?? ''}`}
        {_qaUploadStatus === 'uploading' && 'שומר למחשב...'}
        {_qaUploadStatus === 'idle' && 'לא נשמר עדיין'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
        <button type="button" data-testid="qa-save-to-computer" onClick={() => void sendQaRunsToDevServer(runs)} style={{ ...btnStyle, color: '#60a5fa', borderColor: '#60a5fa' }}>שמור למחשב</button>
        <button type="button" data-testid="qa-clear" onClick={handleClear} style={btnStyle}>Clear</button>
        <button type="button" data-testid="qa-copy-all" onClick={handleCopyAll} style={btnStyle}>Copy JSON</button>
        <button type="button" data-testid="qa-mark-pass" onClick={() => handleMarkLast('pass')} style={{ ...btnStyle, color: '#4ade80', borderColor: '#4ade80' }}>PASS</button>
        <button type="button" data-testid="qa-mark-fail" onClick={() => handleMarkLast('fail')} style={{ ...btnStyle, color: '#f87171', borderColor: '#f87171' }}>FAIL</button>
      </div>
    </div>
  )
}

// ─── Guided Mic QA — state-machine flow ─────────────────────────────
// States: ready → waiting_for_result → result_ready → marked → (next → ready)
// Operator cannot misuse: buttons disabled until their prerequisite state.

type GuidedState = 'ready' | 'recording' | 'processing' | 'result_ready' | 'marked' | 'done'

// Module-level flag so QaRecorderPanel can hide itself during guided QA.
let _guidedQaActive = false
export function isGuidedQaActive(): boolean { return _guidedQaActive }

function findLastRunForExpected(expectedId: string): QaRun | null {
  const runs = loadQaRuns()
  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i]!.expectedId === expectedId) return runs[i]!
  }
  return null
}

function formatExpectedSummary(exp: typeof RELEASE_CANDIDATE_EXPECTATIONS[number]): string {
  const parts: string[] = []
  parts.push(`route: ${exp.expectedRoute}`)
  if (exp.expectedTime) parts.push(`time: ${exp.expectedTime}`)
  if (exp.expectedPersonPolicy !== 'none') parts.push(`person: ${exp.expectedPersonPolicy}`)
  if (exp.expectedSaveAllowed !== null) parts.push(`save: ${exp.expectedSaveAllowed ? 'yes' : 'no'}`)
  return parts.join(' · ')
}

function formatActualSummary(run: QaRun): string {
  const parts: string[] = []
  parts.push(`route: ${run.semanticRoute ?? '—'}`)
  if (run.time) parts.push(`time: ${run.time}`)
  if (run.resolvedPersonName) parts.push(`person: ${run.resolvedPersonName}`)
  else if (run.resolvedPersonStatus && run.resolvedPersonStatus !== 'none') parts.push(`person: ${run.resolvedPersonStatus}`)
  parts.push(`save: ${run.saveAllowed ? 'yes' : 'no'}`)
  return parts.join(' · ')
}

export function GuidedMicQaPanel({ onRecord, voiceState, isRecording }: {
  onRecord: () => void
  voiceState: string
  isRecording: boolean
}) {
  if (!import.meta.env.DEV) return null
  const enabled = useVoiceDebugEnabled()
  const [idx, setIdx] = useState(0)
  const [active, setActive] = useState(false)
  const [state, setState] = useState<GuidedState>('ready')
  const [currentRun, setCurrentRun] = useState<QaRun | null>(null)
  const [marked, setMarked] = useState<'pass' | 'fail' | null>(null)
  // Timestamp when the user pressed the record button for the current phrase.
  // Only runs created AFTER this timestamp are accepted for comparison.
  // Prevents stale runs from previous sessions from triggering result_ready.
  const [recordStartedAt, setRecordStartedAt] = useState(0)

  const total = RELEASE_CANDIDATE_EXPECTATIONS.length
  const exp = RELEASE_CANDIDATE_EXPECTATIONS[idx]

  // Track guided QA active for hiding QaRecorderPanel
  useEffect(() => { _guidedQaActive = active; notifyDebugChanged(); return () => { _guidedQaActive = false } }, [active])

  // Set expected ID when phrase changes
  useEffect(() => {
    if (!active) { setCurrentExpected(null, null); return }
    if (exp) setCurrentExpected(exp.id, exp.utterance)
    else setCurrentExpected(null, null)
  }, [idx, active, exp])

  // Track voiceState to advance ONLY after the user has pressed record
  // (state must already be 'recording' or 'processing' — never 'ready').
  // This prevents stale voiceState from a previous flow from forcing a
  // ready → recording/processing jump on activation.
  useEffect(() => {
    if (!active) return
    // Only advance from recording/processing — never from ready/result_ready/marked
    if (state === 'recording') {
      if (!isRecording && (voiceState === 'transcribing' || voiceState === 'parsing')) {
        setState('processing')
      }
    }
  }, [active, voiceState, isRecording, state])

  // Poll for new QA run matching current expectedId — only accept runs
  // created AFTER recordStartedAt to ignore stale runs from old sessions.
  useEffect(() => {
    if (!active || !exp) return
    if (state !== 'processing' && state !== 'recording') return
    if (recordStartedAt === 0) return // user hasn't pressed record yet
    const check = () => {
      const run = findLastRunForExpected(exp.id)
      if (run) {
        // Only accept runs created after the current record button press
        const runTime = new Date(run.timestamp).getTime()
        if (runTime >= recordStartedAt) {
          setCurrentRun(run)
          setState('result_ready')
        }
      }
    }
    listeners.add(check)
    return () => { listeners.delete(check) }
  }, [active, state, exp, recordStartedAt])

  if (!enabled) return null

  if (!active) {
    return (
      <button
        type="button"
        data-testid="guided-qa-start"
        onClick={() => { setActive(true); setIdx(0); setState('ready'); setMarked(null); setCurrentRun(null) }}
        style={{
          position: 'fixed', top: 8, right: 8, zIndex: 10001,
          padding: '8px 16px', fontSize: 13, fontFamily: "'Heebo', sans-serif", fontWeight: 700,
          border: '1.5px solid rgba(201,168,76,0.55)', borderRadius: 10,
          background: 'rgba(201,168,76,0.15)', color: '#E8C76A', cursor: 'pointer',
          minHeight: 44,
        }}
      >התחל בדיקת מיקרופון</button>
    )
  }

  // End state — all 30 done
  if (idx >= total || !exp) {
    return (
      <div data-testid="guided-qa-panel" data-guided-state="done" dir="rtl" style={{
        position: 'fixed', top: 8, left: 8, right: 8, zIndex: 10001,
        padding: '16px', borderRadius: 14,
        background: 'rgba(8,12,24,0.97)', border: '2px solid rgba(74,222,128,0.50)',
        fontFamily: "'Heebo', sans-serif", boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#4ade80', textAlign: 'center' }}>
          סיימנו את 30 הבדיקות
        </div>
        <button type="button" data-testid="guided-qa-copy-all" onClick={() => copyToClipboard(JSON.stringify(loadQaRuns(), null, 2))} style={{
          padding: '14px', fontSize: 17, fontWeight: 700, borderRadius: 12,
          border: '2px solid rgba(201,168,76,0.60)', background: 'rgba(201,168,76,0.15)',
          color: '#E8C76A', cursor: 'pointer', minHeight: 56,
        }}>
          העתק את כל ה-JSON
        </button>
        <div data-testid="guided-qa-save-status" style={{
          fontSize: 13, textAlign: 'center', padding: '6px',
          color: _qaUploadStatus === 'saved' ? '#4ade80' : _qaUploadStatus === 'failed' ? '#f87171' : 'rgba(255,255,255,0.5)',
        }}>
          {_qaUploadStatus === 'saved' ? 'נשמר למחשב אוטומטית' : _qaUploadStatus === 'failed' ? 'שמירה נכשלה — לחץ העתק' : 'במחשב: tmp/abu-calendar-qa/latest.json'}
        </div>
        <button type="button" data-testid="guided-qa-save-now" onClick={() => void sendQaRunsToDevServer(loadQaRuns())} style={{
          width: '100%', padding: '12px', fontSize: 15, fontWeight: 700, borderRadius: 10,
          border: '1.5px solid rgba(96,165,250,0.50)', background: 'rgba(96,165,250,0.10)',
          color: '#60a5fa', cursor: 'pointer', minHeight: 48,
        }}>
          שמור עכשיו למחשב
        </button>
        <button type="button" data-testid="guided-qa-stop" onClick={() => setActive(false)} style={{
          padding: '8px', fontSize: 13, borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
          color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
        }}>סגור</button>
      </div>
    )
  }

  const handleMark = (result: 'pass' | 'fail') => {
    if (!currentRun) return
    // Update the run in storage
    const runs = loadQaRuns()
    const target = runs.find(r => r.id === currentRun.id)
    if (target) { target.comparisonResult = result; saveQaRuns(runs) }
    setMarked(result)
    setState('marked')
    notifyDebugChanged()
  }
  const handleNext = () => {
    setIdx(i => i + 1)
    setState('ready')
    setCurrentRun(null)
    setMarked(null)
    setRecordStartedAt(0)
  }

  // Auto-comparison (simple check)
  let autoPass: boolean | null = null
  if (currentRun && exp) {
    const routeMap: Record<string, string> = { appointment: 'appointment_create', reminder: 'reminder_create', schedule_query: 'calendar_query', family_query: 'family_query' }
    const actualRoute = currentRun.semanticRoute ?? (currentRun.intent ? (routeMap[currentRun.intent] ?? currentRun.intent) : 'unknown')
    const expectedRoute = exp.expectedRoute
    let routeOk = actualRoute === expectedRoute
    let timeOk = !exp.expectedTime || currentRun.time === exp.expectedTime
    let saveOk = exp.expectedSaveAllowed === null || currentRun.saveAllowed === exp.expectedSaveAllowed
    autoPass = routeOk && timeOk && saveOk
  }

  const passFailEnabled = state === 'result_ready'
  const nextEnabled = state === 'marked'

  const panelBorder = state === 'result_ready' ? (autoPass ? 'rgba(74,222,128,0.50)' : 'rgba(248,113,113,0.50)') : 'rgba(201,168,76,0.50)'

  return (
    <div data-testid="guided-qa-panel" data-guided-state={state} dir="rtl" style={{
      position: 'fixed', top: 8, left: 8, right: 8, zIndex: 10001,
      padding: '14px 16px', borderRadius: 14,
      background: 'rgba(8,12,24,0.97)', border: `2px solid ${panelBorder}`,
      fontFamily: "'Heebo', sans-serif", boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Header: phrase number + stop */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div data-testid="guided-qa-counter" style={{ fontSize: 16, fontWeight: 700, color: '#E8C76A' }}>
          בדיקה {idx + 1} מתוך {total}
        </div>
        <button type="button" data-testid="guided-qa-stop" onClick={() => setActive(false)} style={{
          padding: '4px 10px', fontSize: 11, fontFamily: 'monospace',
          border: '1px solid rgba(255,100,100,0.3)', borderRadius: 6,
          background: 'transparent', color: '#f87171', cursor: 'pointer',
        }}>עצור</button>
      </div>

      {/* Phrase to speak */}
      <div data-testid="guided-qa-phrase" style={{
        fontSize: 19, fontWeight: 700, color: 'rgba(255,255,255,0.95)',
        lineHeight: 1.6, padding: '8px 0',
      }}>
        {exp.utterance}
      </div>

      {/* State-specific content */}
      {state === 'ready' && (
        <div data-testid="guided-qa-instruction">
          <button type="button" data-testid="guided-qa-record-btn" onClick={() => { setRecordStartedAt(Date.now()); onRecord(); setState('recording') }} style={{
            width: '100%', padding: '16px', fontSize: 18, fontWeight: 700, borderRadius: 14,
            border: '2px solid rgba(220,38,38,0.60)', background: 'rgba(220,38,38,0.15)',
            color: '#fca5a5', cursor: 'pointer', minHeight: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 24 }}>🎤</span> לחץ כאן והקלט את המשפט
          </button>
        </div>
      )}

      {state === 'recording' && (
        <div data-testid="guided-qa-recording">
          <div style={{ fontSize: 16, color: 'rgba(251,191,36,0.95)', textAlign: 'center', padding: '8px 0', fontWeight: 600 }}>
            🔴 אני מקשיבה... תגיד את כל המשפט
          </div>
          <button type="button" data-testid="guided-qa-stop-record" onClick={onRecord} style={{
            width: '100%', padding: '14px', fontSize: 16, fontWeight: 700, borderRadius: 12,
            border: '2px solid rgba(251,191,36,0.50)', background: 'rgba(251,191,36,0.10)',
            color: '#fbbf24', cursor: 'pointer', minHeight: 56, marginTop: 8,
          }}>
            סיימתי — עצור הקלטה
          </button>
        </div>
      )}

      {state === 'processing' && (
        <div data-testid="guided-qa-processing" style={{ fontSize: 15, color: 'rgba(201,168,76,0.85)', textAlign: 'center', padding: '14px 0', fontWeight: 600 }}>
          בודקת מה הבנתי...
        </div>
      )}

      {(state === 'result_ready' || state === 'marked') && currentRun && (
        <div data-testid="guided-qa-result">
          {/* Expected vs Actual */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>מה ציפינו:</div>
            <div data-testid="guided-qa-expected" style={{ fontSize: 13, fontFamily: 'monospace', color: 'rgba(201,168,76,0.85)', direction: 'ltr', textAlign: 'left' }}>
              {formatExpectedSummary(exp)}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>מה יצא בפועל:</div>
            <div data-testid="guided-qa-actual" style={{ fontSize: 13, fontFamily: 'monospace', color: 'rgba(255,255,255,0.85)', direction: 'ltr', textAlign: 'left' }}>
              {formatActualSummary(currentRun)}
            </div>
          </div>

          {/* Auto comparison hint */}
          {state === 'result_ready' && autoPass !== null && (
            <div data-testid="guided-qa-auto-hint" style={{
              fontSize: 14, fontWeight: 600, padding: '8px 12px', borderRadius: 8, marginBottom: 8,
              background: autoPass ? 'rgba(74,222,128,0.10)' : 'rgba(248,113,113,0.10)',
              color: autoPass ? '#4ade80' : '#f87171',
              border: `1px solid ${autoPass ? 'rgba(74,222,128,0.30)' : 'rgba(248,113,113,0.30)'}`,
            }}>
              {autoPass
                ? 'נראה תקין — אם גם המסך נראה נכון, לחץ PASS'
                : 'יש פער — בדוק וסמן FAIL'}
            </div>
          )}

          {/* Marked state */}
          {state === 'marked' && marked && (
            <div data-testid="guided-qa-marked" style={{
              fontSize: 15, fontWeight: 700, textAlign: 'center', padding: '8px',
              color: marked === 'pass' ? '#4ade80' : '#f87171',
            }}>
              {marked === 'pass' ? 'סומן PASS' : 'סומן FAIL'}
              <div style={{ fontSize: 11, fontWeight: 400, marginTop: 4, color: _qaUploadStatus === 'saved' ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                {_qaUploadStatus === 'saved' ? 'נשמר למחשב' : _qaUploadStatus === 'failed' ? 'לא נשמר — לחץ שמור עכשיו למחשב' : ''}
              </div>
              {marked === 'fail' && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 400, marginTop: 4 }}>
                  אפשר להמשיך. בסוף נעתיק JSON וננתח הכול.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PASS / FAIL buttons — disabled until result_ready */}
      {(state === 'result_ready') && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" data-testid="guided-qa-pass" disabled={!passFailEnabled} onClick={() => handleMark('pass')} style={{
            flex: 1, padding: '14px', fontSize: 17, fontWeight: 700, borderRadius: 12,
            border: '2px solid rgba(74,222,128,0.50)', background: passFailEnabled ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.03)',
            color: passFailEnabled ? '#4ade80' : 'rgba(255,255,255,0.15)', cursor: passFailEnabled ? 'pointer' : 'not-allowed',
            minHeight: 56,
          }}>PASS</button>
          <button type="button" data-testid="guided-qa-fail" disabled={!passFailEnabled} onClick={() => handleMark('fail')} style={{
            flex: 1, padding: '14px', fontSize: 17, fontWeight: 700, borderRadius: 12,
            border: '2px solid rgba(248,113,113,0.50)', background: passFailEnabled ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.03)',
            color: passFailEnabled ? '#f87171' : 'rgba(255,255,255,0.15)', cursor: passFailEnabled ? 'pointer' : 'not-allowed',
            minHeight: 56,
          }}>FAIL</button>
        </div>
      )}

      {/* Next button — disabled until marked */}
      {state === 'marked' && (
        <button type="button" data-testid="guided-qa-next" onClick={handleNext} style={{
          width: '100%', padding: '14px', fontSize: 16, fontWeight: 700, borderRadius: 12,
          border: '2px solid rgba(201,168,76,0.50)', background: 'rgba(201,168,76,0.15)',
          color: '#E8C76A', cursor: 'pointer', minHeight: 56,
        }}>
          הבא →
        </button>
      )}

      {/* Help line — always visible */}
      <div data-testid="guided-qa-help" style={{
        fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center',
        borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8,
        direction: 'ltr', fontFamily: 'monospace',
      }}>
        הסדר: מיקרופון → לדבר → לבדוק תוצאה → PASS/FAIL → Next
      </div>
    </div>
  )
}
