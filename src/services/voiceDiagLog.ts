/*
 * Lightweight production-safe voice diagnostic log.
 *
 * Stores last 20 voice attempts in localStorage. No UI — only accessible
 * via console or "copy diagnostic report" button in admin/diagnostics.
 *
 * Never stores raw audio. Only metadata for debugging.
 */

import { APP_VERSION } from '../version'

export interface VoiceDiagEntry {
  ts: string
  ver: string
  transcript: string
  route: string
  date: string | null
  time: string | null
  person: string | null
  saveAllowed: boolean | null
  error: string | null
}

const DIAG_KEY = 'abu-voice-diag'
const MAX_ENTRIES = 20

export function appendVoiceDiag(entry: Omit<VoiceDiagEntry, 'ts' | 'ver'>): void {
  try {
    const raw = localStorage.getItem(DIAG_KEY)
    const entries: VoiceDiagEntry[] = raw ? JSON.parse(raw) : []
    entries.push({
      ts: new Date().toISOString(),
      ver: APP_VERSION.version,
      ...entry,
    })
    // Keep only last MAX_ENTRIES
    const trimmed = entries.slice(-MAX_ENTRIES)
    localStorage.setItem(DIAG_KEY, JSON.stringify(trimmed))
  } catch { /* quota or parse error — silent */ }
}

export function getVoiceDiagReport(): string {
  try {
    const raw = localStorage.getItem(DIAG_KEY)
    if (!raw) return 'No voice diagnostic data.'
    const entries: VoiceDiagEntry[] = JSON.parse(raw)
    if (entries.length === 0) return 'No voice diagnostic data.'
    const lines = entries.map((e, i) => {
      const parts = [`#${i + 1} [${e.ts}] v${e.ver}`]
      parts.push(`  transcript: "${e.transcript}"`)
      parts.push(`  route: ${e.route}`)
      if (e.date) parts.push(`  date: ${e.date}`)
      if (e.time) parts.push(`  time: ${e.time}`)
      if (e.person) parts.push(`  person: ${e.person}`)
      if (e.saveAllowed !== null) parts.push(`  save: ${e.saveAllowed ? 'yes' : 'no'}`)
      if (e.error) parts.push(`  error: ${e.error}`)
      return parts.join('\n')
    })
    return `AbuBank Voice Diagnostic Report\n${APP_VERSION.version} / ${APP_VERSION.buildDate}\n${'─'.repeat(40)}\n${lines.join('\n\n')}`
  } catch {
    return 'Error reading diagnostic data.'
  }
}

export function clearVoiceDiag(): void {
  try { localStorage.removeItem(DIAG_KEY) } catch {}
}
