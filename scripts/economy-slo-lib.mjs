/*
 * economy-slo-lib.mjs — PURE QA-economy SLO judge. (§16 / C8 / B2)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Judges a MEASURED economy block (from QA_MONSTER_REPORT.json.economy) against the PRE-DECLARED SLO.
 * A tier over target = MISSED (a QA-system finding). Assurance is never reduced to hit a target. No I/O.
 */
export function judgeEconomy(slo, tier, measured) {
  const t = slo?.tiers?.[tier]
  if (!t) return { tier, verdict: 'NO_SLO', reasons: [`no SLO declared for tier ${tier}`] }
  const reasons = []
  if (measured?.wallClockMs != null && measured.wallClockMs > t.wallClockMsTarget)
    reasons.push(`wall-clock ${measured.wallClockMs}ms > target ${t.wallClockMsTarget}ms`)
  if (measured?.networkAreaCount != null && t.providerCallTarget != null && measured.networkAreaCount > t.providerCallTarget)
    reasons.push(`provider-touching areas ${measured.networkAreaCount} > target ${t.providerCallTarget}`)
  return { tier, verdict: reasons.length ? 'MISSED' : 'MET', reasons, target: t }
}
