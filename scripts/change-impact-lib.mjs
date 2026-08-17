/*
 * change-impact-lib.mjs — PURE change-impact → evidence-invalidation mapping. (§19/B4)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Maps changed paths to affected capabilities/evidence. Relevant change invalidates relevant proof;
 * an UNKNOWN path (no rule) WIDENS scope (invalidates everything) — never silently narrows. No I/O.
 */
// path-prefix → affected capability ids. Order matters (first match wins).
export const PATH_RULES = [
  { prefix: 'api/', capabilities: ['deployed-secret-safety', 'billing-abuse-boundary', 'current-info-freshness', 'stt-tts-roundtrip'] },
  { prefix: 'src/services/', capabilities: ['stt-tts-roundtrip', 'tool-call-ordering', 'calendar-write-readback'] },
  { prefix: 'src/screens/AbuAI/', capabilities: ['tool-call-ordering', 'calendar-write-readback', 'escape-regression-closure'] },
  { prefix: 'src/screens/AbuWhatsApp/', capabilities: ['whatsapp-message-generation'] },
  { prefix: 'knowledge/', capabilities: ['escape-regression-closure', 'whatsapp-message-generation'] },
  { prefix: 'scripts/', capabilities: ['__HARNESS__'] },
  { prefix: 'src/engineering-os/', capabilities: ['__HARNESS__'] },
]

/**
 * @param changedPaths array of changed file paths
 * @returns { affectedCapabilities:Set-as-array, widen:boolean, unknownPaths }
 */
export function changeImpact(changedPaths = []) {
  const affected = new Set()
  const unknownPaths = []
  let widen = false
  for (const p of changedPaths) {
    const rule = PATH_RULES.find((r) => p.startsWith(r.prefix))
    if (!rule) { unknownPaths.push(p); widen = true; continue } // unknown mechanism → widen scope
    for (const c of rule.capabilities) affected.add(c)
  }
  return { affectedCapabilities: [...affected], widen, unknownPaths }
}

/** Decide whether a piece of evidence for `capability` may be reused given a change set. */
export function evidenceSurvivesChange(capability, changedPaths = []) {
  const impact = changeImpact(changedPaths)
  if (impact.widen) return { reuse: false, reason: 'unknown changed path — scope widened' }
  const affected = impact.affectedCapabilities.includes(capability) || impact.affectedCapabilities.includes('__HARNESS__')
  return { reuse: !affected, reason: affected ? 'capability affected by change' : 'change proven unrelated' }
}
