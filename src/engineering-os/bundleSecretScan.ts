/*
 * BUNDLE SECRET SCAN — catch a BILLABLE key baked into the shipped client bundle. (P0 incident)
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * THE GAP THIS CLOSES. scripts/check-client-secret-leak.cjs checks the BUILD ENV and dist/ for
 * loose `sk-` tokens; clientProviderKeyContract.test.ts checks client SOURCE never READS a
 * billable key. Neither catches the actual leak observed on the deployed 0.286 RC: a whole-object
 * `import.meta.env` reference (executiveCognitiveController.ts) made Vite INLINE every VITE_ var —
 * including a `VITE_AZURE_TTS_KEY` that had been set in the Vercel build env — into the served
 * bundle as `VITE_AZURE_TTS_KEY:"<value>"`, even though no code reads it.
 *
 * This scanner looks at the SHIPPED bundle text (built or deployed, read-only) for a billable key
 * NAME assigned a real-looking value. It is the gate that would have caught the incident.
 */

/** Billable keys that must NEVER appear with a value in a client bundle (server-only). */
export const BILLABLE_CLIENT_KEYS = ['VITE_AZURE_TTS_KEY', 'VITE_OPENAI_API_KEY'] as const

export interface BundleSecretFinding {
  key: string
  /** A short, redacted marker of the match — NEVER the full secret. */
  redactedSample: string
}

export interface BundleScanResult {
  findings: BundleSecretFinding[]
  clean: boolean
}

/** Redact a matched value: keep a 4-char prefix, mask the rest, never emit the full secret. */
function redact(value: string): string {
  const v = value.replace(/^["']|["']$/g, '')
  if (v.length <= 4) return '****'
  return `${v.slice(0, 4)}…(${v.length} chars, redacted)`
}

/**
 * Scan bundle text for a billable key assigned a real-looking value. Detects both object-literal
 * inlining (`VITE_AZURE_TTS_KEY:"abc123…"`) and assignment (`VITE_AZURE_TTS_KEY="abc123…"`). A
 * value of ≥12 non-trivial chars is treated as a real secret; empty/placeholder values are ignored.
 */
export function scanBundleForBillableSecrets(bundleText: string, keys: readonly string[] = BILLABLE_CLIENT_KEYS): BundleScanResult {
  const findings: BundleSecretFinding[] = []
  for (const key of keys) {
    // key : "value"   or   key = "value"   or   key:'value'
    const re = new RegExp(`${key}\\s*[:=]\\s*["']([^"']{12,})["']`, 'g')
    for (const m of bundleText.matchAll(re)) {
      const value = m[1]!
      // Ignore obvious placeholders / disabled markers (exact tokens or well-known filler words).
      if (/^(undefined|null|false|true)$/i.test(value)) continue
      if (/your[_-]?key|placeholder|example|changeme|dummy|xxxx/i.test(value)) continue
      findings.push({ key, redactedSample: redact(value) })
    }
  }
  return { findings, clean: findings.length === 0 }
}
