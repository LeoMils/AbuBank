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

import { useEffect, useState } from 'react'
import type { VoiceTrace } from './voiceTrace'
import type { ReminderDraft } from './reminders/types'

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
  const route = reminderDraft
    ? 'reminder'
    : trace?.parseDecision || trace?.semanticIntent || null
  const intent = trace?.semanticIntent || trace?.parseDecision || (reminderDraft ? 'reminder' : null)
  const date = reminderDraft?.displayDateLabel ?? trace?.extractedDate ?? null
  const time = reminderDraft?.displayTimeLabel ?? trace?.extractedStartTime ?? null
  const relation = reminderDraft?.familyResolution?.originalPhrase ?? null
  const person = reminderDraft?.familyResolution?.resolvedName
    ?? (trace?.extractedPeople && trace.extractedPeople.length > 0
        ? trace.extractedPeople.join(', ')
        : null)

  // Derived save-allowed estimate. Honest, not a hard guarantee — the
  // real gate lives inside ConfirmCard/ReminderConfirmCard, but this
  // gives the operator immediate signal.
  let saveAllowed: 'yes' | 'no' = 'no'
  let reason = '—'
  if (reminderDraft) {
    const fr = reminderDraft.familyResolution
    if (reminderDraft.ambiguity) {
      reason = 'ambiguity unresolved'
    } else if (reminderDraft.missingFields?.includes('title')) {
      reason = 'missing title'
    } else if (!reminderDraft.dueAt) {
      reason = 'missing dueAt'
    } else if (fr?.status === 'ambiguous') {
      reason = 'family ambiguous'
    } else {
      saveAllowed = 'yes'
      reason = 'ok'
    }
  } else if (route === 'appointment') {
    if (!date) reason = 'missing date'
    else if (!time) reason = 'missing time'
    else { saveAllowed = 'yes'; reason = 'ok' }
  } else if (route === 'schedule_query' || route === 'family_query') {
    reason = 'query: no save'
  } else if (route) {
    reason = `route=${route}`
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
      <div data-testid="mic-qa-save-allowed">saveAllowed: {saveAllowed}</div>
      <div data-testid="mic-qa-reason">reason: {reason}</div>
    </div>
  )
}
