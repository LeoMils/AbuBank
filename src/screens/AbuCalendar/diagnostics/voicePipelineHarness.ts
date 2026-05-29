/*
 * Voice Pipeline Diagnostic Harness — pure, read-only.
 *
 * Runs a single utterance through the production pipeline (cleanTranscript →
 * isScheduleQuery → detectReminderIntent → parseReminder / parseLocally +
 * extract/resolvePersonPhrase) and returns a flat row of every decision the
 * pipeline made. Designed for fixture-based debugging, not for runtime use.
 *
 * The harness does NOT modify any pipeline module; it imports them as-is.
 */

import { cleanTranscript, parseLocally } from '../localParser'
import { isScheduleQuery } from '../intentParser'
import { extractPersonPhrase, resolvePersonPhrase } from '../familyResolve'
import { detectReminderIntent, parseReminder } from '../reminders/reminderParser'

export type DiagnosticIntent = 'reminder' | 'appointment' | 'schedule_query' | 'unknown'
export type DiagnosticConfidence = 'high' | 'medium' | 'low'
export type RelationStatus = 'resolved' | 'ambiguous' | 'missing' | 'none'

export interface DiagnosticRow {
  rawTranscript: string
  normalizedTranscript: string
  intent: DiagnosticIntent
  dateParse: { date: string | null; label: string | null }
  timeParse: { time: string | null; ambiguous: boolean; label: string | null }
  relationPhrase: string | null
  resolvedPerson: { status: RelationStatus; name: string | null; candidates: string[] }
  confidence: DiagnosticConfidence
  finalConfirmationText: string
  saveAllowed: { allowed: boolean; reason: string }
}

/**
 * Run the diagnostic on a single utterance. `todayISO` pins the relative
 * date base so reruns are deterministic.
 */
export function runVoicePipelineDiagnostic(rawText: string, todayISO: string): DiagnosticRow {
  const normalized = cleanTranscript(rawText)

  if (isScheduleQuery(normalized)) {
    return {
      rawTranscript: rawText,
      normalizedTranscript: normalized,
      intent: 'schedule_query',
      dateParse: { date: null, label: null },
      timeParse: { time: null, ambiguous: false, label: null },
      relationPhrase: null,
      resolvedPerson: { status: 'none', name: null, candidates: [] },
      confidence: 'high',
      finalConfirmationText: '',
      saveAllowed: { allowed: false, reason: 'schedule_query_no_save' },
    }
  }

  const intentRaw = detectReminderIntent(normalized)

  if (intentRaw === 'reminder') return rowFromReminder(rawText, normalized, todayISO)
  if (intentRaw === 'appointment') return rowFromAppointment(rawText, normalized, todayISO, 'appointment')
  return rowFromAppointment(rawText, normalized, todayISO, 'unknown')
}

function rowFromReminder(rawText: string, normalized: string, todayISO: string): DiagnosticRow {
  const draft = parseReminder(rawText, todayISO)
  const fr = draft.familyResolution
  const status: RelationStatus = fr ? fr.status : 'none'
  const missing = draft.missingFields
  const hasTitle = !missing.includes('title') && !!draft.title
  const hasDate = !missing.includes('date') && !!draft.dueAt
  const hasTime = !missing.includes('time')
  const blocked: string[] = []
  if (!hasTitle) blocked.push('missing_title')
  if (!hasDate) blocked.push('missing_date')
  if (!hasTime) blocked.push('missing_time')
  if (draft.ambiguity) blocked.push(`ambiguity_${draft.ambiguity.type}`)
  if (status === 'ambiguous') blocked.push('person_ambiguous')
  const allowed = blocked.length === 0
  const confidence = scoreConfidence(hasTitle, hasDate, hasTime, draft.ambiguity != null, status)

  return {
    rawTranscript: rawText,
    normalizedTranscript: normalized,
    intent: 'reminder',
    dateParse: {
      date: draft.dueAt ? draft.dueAt.slice(0, 10) : null,
      label: draft.displayDateLabel ?? null,
    },
    timeParse: {
      time: draft.dueAt ? draft.dueAt.slice(11, 16) : null,
      ambiguous: draft.ambiguity?.type === 'time',
      label: draft.displayTimeLabel ?? null,
    },
    relationPhrase: fr?.originalPhrase ?? null,
    resolvedPerson: {
      status,
      name: fr?.resolvedName ?? null,
      candidates: fr?.candidates ?? [],
    },
    confidence,
    finalConfirmationText: draft.readbackText,
    saveAllowed: { allowed, reason: allowed ? 'ok' : blocked.join('+') },
  }
}

function rowFromAppointment(
  rawText: string,
  normalized: string,
  todayISO: string,
  intent: 'appointment' | 'unknown',
): DiagnosticRow {
  const draft = parseLocally(normalized, todayISO)
  const phrase = extractPersonPhrase(normalized)
  const resolved = phrase ? resolvePersonPhrase(phrase) : { status: 'none' as const }
  const status: RelationStatus =
    resolved.status === 'resolved' ? 'resolved'
    : resolved.status === 'ambiguous' ? 'ambiguous'
    : resolved.status === 'missing' ? 'missing'
    : 'none'

  const hasTitle = !!draft.title && draft.title.trim().length > 0
  const hasDate = !!draft.date
  const hasTime = !!draft.time
  const blocked: string[] = []
  if (!hasTitle) blocked.push('missing_title')
  if (!hasDate) blocked.push('missing_date')
  if (!hasTime) blocked.push('missing_time')
  if (draft.ambiguousTime) blocked.push('time_ambiguous')
  if (status === 'ambiguous') blocked.push('person_ambiguous')
  if (status === 'missing') blocked.push('person_missing')
  const allowed = intent === 'appointment' && blocked.length === 0
  const confidence = scoreConfidence(hasTitle, hasDate, hasTime, draft.ambiguousTime, status)

  const confirmText = hasTitle && hasDate && hasTime
    ? `${draft.title} · ${draft.date} · ${draft.time}`
    : ''

  return {
    rawTranscript: rawText,
    normalizedTranscript: normalized,
    intent,
    dateParse: { date: draft.date, label: null },
    timeParse: { time: draft.time, ambiguous: draft.ambiguousTime, label: null },
    relationPhrase: phrase,
    resolvedPerson: {
      status,
      name: resolved.status === 'resolved' ? resolved.name : null,
      candidates: resolved.status === 'ambiguous' ? resolved.candidates : [],
    },
    confidence,
    finalConfirmationText: confirmText,
    saveAllowed: {
      allowed,
      reason: allowed ? 'ok' : (intent === 'unknown' ? 'intent_unknown' : blocked.join('+') || 'blocked'),
    },
  }
}

function scoreConfidence(
  hasTitle: boolean,
  hasDate: boolean,
  hasTime: boolean,
  ambiguous: boolean,
  personStatus: RelationStatus,
): DiagnosticConfidence {
  if (ambiguous || personStatus === 'ambiguous') return 'low'
  const filled = [hasTitle, hasDate, hasTime].filter(Boolean).length
  if (filled === 3 && (personStatus === 'resolved' || personStatus === 'none')) return 'high'
  if (filled >= 2) return 'medium'
  return 'low'
}

/**
 * Format a DiagnosticRow as a deterministic multi-line block for snapshots
 * and console review. One row = one block; blocks are separated by a blank
 * line in the batch formatter.
 */
export function formatDiagnosticRow(row: DiagnosticRow): string {
  return [
    `raw:           ${row.rawTranscript}`,
    `normalized:    ${row.normalizedTranscript}`,
    `intent:        ${row.intent}`,
    `date:          ${row.dateParse.date ?? '—'}  label=${row.dateParse.label ?? '—'}`,
    `time:          ${row.timeParse.time ?? '—'}  ambiguous=${row.timeParse.ambiguous}  label=${row.timeParse.label ?? '—'}`,
    `relation:      ${row.relationPhrase ?? '—'}`,
    `person:        status=${row.resolvedPerson.status}  name=${row.resolvedPerson.name ?? '—'}  candidates=[${row.resolvedPerson.candidates.join(', ')}]`,
    `confidence:    ${row.confidence}`,
    `confirmation:  ${row.finalConfirmationText || '—'}`,
    `save:          allowed=${row.saveAllowed.allowed}  reason=${row.saveAllowed.reason}`,
  ].join('\n')
}

export function formatDiagnosticBatch(rows: DiagnosticRow[]): string {
  return rows.map((r, i) => `── #${String(i + 1).padStart(2, '0')} ─────────────────────\n${formatDiagnosticRow(r)}`).join('\n\n')
}
