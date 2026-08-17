/*
 * escape-to-detector-lib.mjs — PURE escape→detector conversion contract. (§21/B6)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The canonical workflow that converts any owner-found automatable defect into permanent machine memory.
 * Validates that an escape record carries every required output field before it can be marked closed.
 * No I/O.
 */
export const REQUIRED_ESCAPE_FIELDS = ['id', 'originalFailure', 'howFalseConfidence', 'detector', 'closureState', 'affectedReleaseLayer']

export function validateEscapeRecord(rec = {}) {
  const missing = REQUIRED_ESCAPE_FIELDS.filter((f) => !rec[f])
  // A closed escape must name a detector; an open one must not claim closure.
  if (rec.closureState === 'CLOSED' && !rec.detector) missing.push('detector (required to close)')
  return { ok: missing.length === 0, missing }
}

/** Scaffold the record a fresh defect must fill in (returned by the CLI for a new defect id). */
export function scaffold(defectId) {
  return {
    id: defectId, originalFailure: 'TODO', howFalseConfidence: 'TODO',
    siblingFailureClass: 'TODO', whyControlsMissed: 'TODO', denominatorOrEvidenceGap: 'TODO',
    detector: 'TODO (path to new/updated test)', sensitivityProof: 'TODO', historicalCorpusEntry: 'TODO',
    changeImpactLink: 'TODO', closureState: 'OPEN', affectedReleaseLayer: 'TODO',
  }
}
