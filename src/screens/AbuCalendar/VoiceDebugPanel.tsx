/*
 * VoiceDebugPanel — operator-only QA diagnostic for the live voice flow.
 *
 * Renders ONLY when localStorage['abu-voice-debug'] === 'true'. Hidden by
 * default. Surfaces the four fields a mic-QA operator needs to verify the
 * text pipeline end-to-end:
 *   • raw transcript (what ASR returned)
 *   • normalized transcript (after deterministic correction)
 *   • route (parseDecision / semanticIntent / 'reminder')
 *   • parsed date / time / person (whatever the parser extracted)
 *
 * Never shows for Martita. Never exposes raw transcripts in the normal flow.
 */

import { useState } from 'react'
import type { VoiceTrace } from './voiceTrace'
import type { ReminderDraft } from './reminders/types'

export const VOICE_DEBUG_LOCALSTORAGE_KEY = 'abu-voice-debug'

export function isVoiceDebugEnabled(): boolean {
  try {
    return typeof localStorage !== 'undefined'
      && localStorage.getItem(VOICE_DEBUG_LOCALSTORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Tiny operator-only toggle. Renders ONLY in DEV builds, so production
 * users never see it. Clicking it flips the `abu-voice-debug` flag,
 * which gates the diagnostic panel above. No DevTools required.
 */
export function VoiceDebugToggle() {
  if (!import.meta.env.DEV) return null
  const [on, setOn] = useState<boolean>(isVoiceDebugEnabled())
  function flip() {
    const next = !on
    try { localStorage.setItem(VOICE_DEBUG_LOCALSTORAGE_KEY, next ? 'true' : 'false') } catch { /* ignore */ }
    setOn(next)
  }
  return (
    <button
      type="button"
      data-testid="voice-debug-toggle"
      aria-label="toggle mic QA debug panel"
      onClick={flip}
      style={{
        position: 'fixed',
        bottom: 8,
        right: 8,
        zIndex: 9999,
        padding: '2px 8px',
        fontSize: 10,
        fontFamily: 'monospace',
        color: on ? '#0B0F1F' : 'rgba(201,168,76,0.55)',
        background: on ? 'rgba(232,199,106,0.85)' : 'rgba(8,12,24,0.55)',
        border: '1px solid rgba(201,168,76,0.45)',
        borderRadius: 6,
        cursor: 'pointer',
        userSelect: 'none',
        opacity: on ? 0.92 : 0.6,
      }}
    >QA{on ? ' ●' : ''}</button>
  )
}

interface Props {
  trace: VoiceTrace | null
  reminderDraft?: ReminderDraft | null
}

export function VoiceDebugPanel({ trace, reminderDraft }: Props) {
  if (!isVoiceDebugEnabled()) return null
  if (!trace && !reminderDraft) return null

  const raw = trace?.rawTranscript ?? null
  const normalized = trace?.transcript ?? trace?.correctedTranscript ?? null
  const route = reminderDraft
    ? 'reminder'
    : trace?.parseDecision || trace?.semanticIntent || null
  const date = reminderDraft?.displayDateLabel ?? trace?.extractedDate ?? null
  const time = reminderDraft?.displayTimeLabel ?? trace?.extractedStartTime ?? null
  const person = reminderDraft?.familyResolution?.resolvedName
    ?? reminderDraft?.familyResolution?.originalPhrase
    ?? (trace?.extractedPeople && trace.extractedPeople.length > 0
        ? trace.extractedPeople.join(', ')
        : null)

  return (
    <div
      data-testid="mic-qa-trace"
      dir="ltr"
      style={{
        position: 'fixed',
        bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
        right: 8,
        zIndex: 9998,
        maxWidth: 320,
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
      <div data-testid="mic-qa-date">date: {date ?? '—'}</div>
      <div data-testid="mic-qa-time">time: {time ?? '—'}</div>
      <div data-testid="mic-qa-person">person: {person ?? '—'}</div>
    </div>
  )
}
