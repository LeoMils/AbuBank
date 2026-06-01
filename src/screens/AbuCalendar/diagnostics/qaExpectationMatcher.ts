/*
 * QA expectation matcher + failure layer classifier.
 *
 * compareQaRunToExpectation(run, expectation) → ComparisonResult
 *
 * Given a QaRun (from real mic or text harness) and a QaExpectation,
 * determines pass/fail, which fields failed, and which pipeline layer
 * is the suspected root cause.
 *
 * Pure function — no React, no I/O, no side effects.
 */

import type { QaRun, QaExpectation, ComparisonResult, FailureLayer } from './qaRunTypes'

/** Map DiagnosticRow intent names to SemanticRoute names for comparison. */
function normalizeRoute(intent: string | null): string {
  if (!intent) return 'unknown'
  if (intent === 'appointment') return 'appointment_create'
  if (intent === 'reminder') return 'reminder_create'
  if (intent === 'schedule_query') return 'calendar_query'
  return intent
}

export function compareQaRunToExpectation(
  run: QaRun,
  expectation: QaExpectation,
): ComparisonResult {
  const failed: string[] = []
  let layer: FailureLayer = 'UNKNOWN'

  // ── 0. Transcript existence ────────────────────────────────────────
  // If rawTranscript is null/empty, mic or STT failed entirely.
  if (!run.rawTranscript?.trim()) {
    return {
      pass: false,
      failedFields: ['rawTranscript'],
      suspectedLayer: run.blobSize && run.blobSize > 1000 ? 'STT' : 'MIC_CAPTURE',
      severity: expectation.criticality,
      explanation: 'No transcript received — mic capture or STT failed.',
    }
  }

  // ── 1. Route / intent ──────────────────────────────────────────────
  const actualRoute = normalizeRoute(run.semanticRoute ?? run.intent)
  const expectedRoute = normalizeRoute(expectation.expectedRoute)
  if (actualRoute !== expectedRoute) {
    failed.push('route')
    // Determine if routing failure or upstream
    if (run.normalizedTranscript && run.normalizedTranscript.length > 3) {
      layer = 'ROUTING'
    } else {
      layer = 'NORMALIZATION'
    }
  }

  // ── 2. Time ────────────────────────────────────────────────────────
  if (expectation.expectedTime !== null) {
    const actualTime = run.time
    if (actualTime !== expectation.expectedTime) {
      failed.push('time')
      if (layer === 'UNKNOWN') layer = 'TIME_PARSE'
    }
  }

  // ── 3. Date policy ─────────────────────────────────────────────────
  if (expectation.expectedDatePolicy !== 'any' && expectation.expectedDatePolicy !== 'none') {
    const hasDate = !!run.date
    if (expectation.expectedDatePolicy === 'none' && hasDate) {
      failed.push('date')
    } else if (expectation.expectedDatePolicy !== 'none' && !hasDate) {
      failed.push('date')
      if (layer === 'UNKNOWN') layer = 'TIME_PARSE'
    }
    // We don't check exact date for 'tomorrow'/'today' because the actual
    // date depends on when the test runs. The golden tests pin this.
  }

  // ── 4. Relation phrase ─────────────────────────────────────────────
  if (expectation.expectedRelationPolicy !== 'none') {
    if (expectation.expectedRelationPolicy === 'present') {
      if (!run.relationPhrase) {
        failed.push('relationPhrase')
        if (layer === 'UNKNOWN') layer = 'FAMILY_RESOLVE'
      }
    } else {
      // Specific phrase expected
      if (run.relationPhrase !== expectation.expectedRelationPolicy) {
        failed.push('relationPhrase')
        if (layer === 'UNKNOWN') layer = 'FAMILY_RESOLVE'
      }
    }
  }

  // ── 5. Person resolution ───────────────────────────────────────────
  if (expectation.expectedPersonPolicy !== 'none') {
    const policy = expectation.expectedPersonPolicy
    if (policy.startsWith('resolved:')) {
      const expectedName = policy.slice('resolved:'.length)
      if (run.resolvedPersonName !== expectedName) {
        failed.push('resolvedPersonName')
        if (layer === 'UNKNOWN') layer = 'FAMILY_RESOLVE'
      }
    } else if (policy === 'ambiguous') {
      if (run.resolvedPersonStatus !== 'ambiguous') {
        failed.push('resolvedPersonStatus')
        if (layer === 'UNKNOWN') layer = 'FAMILY_RESOLVE'
      }
    } else if (policy === 'missing') {
      if (run.resolvedPersonStatus !== 'missing') {
        failed.push('resolvedPersonStatus')
        if (layer === 'UNKNOWN') layer = 'FAMILY_RESOLVE'
      }
    } else if (policy === 'any_honest') {
      // Just ensure no silent invention — name must be null if not resolved
      if (run.resolvedPersonStatus === 'resolved' && !run.resolvedPersonName) {
        failed.push('resolvedPersonName')
        if (layer === 'UNKNOWN') layer = 'FAMILY_RESOLVE'
      }
    }
  }

  // ── 6. Save gate ───────────────────────────────────────────────────
  if (expectation.expectedSaveAllowed !== null) {
    if (run.saveAllowed !== expectation.expectedSaveAllowed) {
      failed.push('saveAllowed')
      if (layer === 'UNKNOWN') layer = 'SAVE_GATE'
    }
  }

  // ── Build explanation ──────────────────────────────────────────────
  if (failed.length === 0) {
    return {
      pass: true,
      failedFields: [],
      suspectedLayer: 'UNKNOWN',
      severity: expectation.criticality,
      explanation: 'All checked fields match expectation.',
    }
  }

  // Classify layer from failed fields if not yet set
  if (layer === 'UNKNOWN') {
    if (failed.includes('route')) layer = 'ROUTING'
    else if (failed.includes('time') || failed.includes('date')) layer = 'TIME_PARSE'
    else if (failed.includes('relationPhrase') || failed.includes('resolvedPersonName') || failed.includes('resolvedPersonStatus')) layer = 'FAMILY_RESOLVE'
    else if (failed.includes('saveAllowed')) layer = 'SAVE_GATE'
  }

  return {
    pass: false,
    failedFields: failed,
    suspectedLayer: layer,
    severity: expectation.criticality,
    explanation: `Failed fields: ${failed.join(', ')}. Suspected layer: ${layer}.`,
  }
}

/**
 * Classify a QaRun's failure layer from its fields alone (no expectation).
 * Used when the operator marks a run FAIL without a matched expectation.
 */
export function classifyFailureLayer(run: QaRun): FailureLayer {
  if (!run.rawTranscript?.trim()) {
    return run.blobSize && run.blobSize > 1000 ? 'STT' : 'MIC_CAPTURE'
  }
  if (run.normalizedTranscript && run.rawTranscript
      && run.normalizedTranscript.length < run.rawTranscript.length * 0.5) {
    return 'NORMALIZATION'
  }
  if (!run.semanticRoute || run.semanticRoute === 'unknown') {
    return 'ROUTING'
  }
  if (run.semanticRoute === 'appointment_create' || run.semanticRoute === 'reminder_create') {
    if (!run.time && !run.date) return 'TIME_PARSE'
    if (run.resolvedPersonStatus === 'missing' && run.relationPhrase) return 'FAMILY_RESOLVE'
    if (!run.saveAllowed && run.saveBlockReason) return 'SAVE_GATE'
  }
  return 'UNKNOWN'
}
