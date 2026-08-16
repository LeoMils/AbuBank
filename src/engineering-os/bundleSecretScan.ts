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

/*
 * SHIPPED-KEY CONTRACT (Stage 3C §2–3). Classify env-var NAMES by intended exposure so the
 * scanner distinguishes a real secret from legitimate public client configuration. A value's
 * mere presence in the bundle is only a leak for a credential-kind key — a region id / version
 * / commit sha is PUBLIC by design and must NOT false-fail.
 */
export type KeyKind = 'BILLABLE_SERVER_ONLY' | 'CLIENT_ALLOWED_CREDENTIAL' | 'PUBLIC_CONFIG'
export interface KeySpec { name: string; kind: KeyKind }

export const SHIPPED_KEY_CONTRACT: readonly KeySpec[] = [
  // Billable / server-only credentials — must NEVER appear with a value in a client bundle.
  { name: 'VITE_AZURE_TTS_KEY', kind: 'BILLABLE_SERVER_ONLY' },
  { name: 'VITE_OPENAI_API_KEY', kind: 'BILLABLE_SERVER_ONLY' },
  { name: 'VITE_BRAVE_API_KEY', kind: 'BILLABLE_SERVER_ONLY' },
  { name: 'VITE_EXA_API_KEY', kind: 'BILLABLE_SERVER_ONLY' },
  { name: 'VITE_OPENROUTER_API_KEY', kind: 'BILLABLE_SERVER_ONLY' },
  { name: 'VITE_PERPLEXITY_API_KEY', kind: 'BILLABLE_SERVER_ONLY' },
  { name: 'VITE_TAVILY_API_KEY', kind: 'BILLABLE_SERVER_ONLY' },
  // Free-tier credentials the repo documents as client-allowed — still credentials; owner §2
  // wants them treated as exposed if their real value ships.
  { name: 'VITE_GROQ_API_KEY', kind: 'CLIENT_ALLOWED_CREDENTIAL' },
  { name: 'VITE_GEMINI_API_KEY', kind: 'CLIENT_ALLOWED_CREDENTIAL' },
  // Legitimately public client configuration — presence is NOT a leak.
  { name: 'VITE_AZURE_TTS_REGION', kind: 'PUBLIC_CONFIG' },
  { name: 'VITE_APP_VERSION', kind: 'PUBLIC_CONFIG' },
  { name: 'VITE_COMMIT_SHA', kind: 'PUBLIC_CONFIG' },
]

export type ExposureClass =
  | 'CONFIRMED_SECRET_EXPOSED'
  | 'PUBLIC_CLIENT_CONFIGURATION'
  | 'SUSPICIOUS_NEEDS_CLASSIFICATION'
  | 'NOT_PRESENT_IN_SHIPPED_BUNDLE'

export interface KeyClassification {
  name: string
  kind: KeyKind
  exposure: ExposureClass
  /** Redacted marker of the matched value — never the real secret. */
  redactedSample?: string
}

/**
 * Classify every contract key against a shipped bundle. A credential-kind key with a real
 * value → CONFIRMED_SECRET_EXPOSED. A public-config key with a value → PUBLIC_CLIENT_CONFIGURATION
 * (not a leak). Absent → NOT_PRESENT_IN_SHIPPED_BUNDLE.
 */
export function classifyShippedKeys(bundleText: string, contract: readonly KeySpec[] = SHIPPED_KEY_CONTRACT): KeyClassification[] {
  return contract.map((spec) => {
    const re = new RegExp(`${spec.name}\\s*[:=]\\s*["']([^"']*)["']`)
    const m = bundleText.match(re)
    if (!m) return { name: spec.name, kind: spec.kind, exposure: 'NOT_PRESENT_IN_SHIPPED_BUNDLE' as ExposureClass }
    const value = m[1] ?? ''
    if (spec.kind === 'PUBLIC_CONFIG') return { name: spec.name, kind: spec.kind, exposure: 'PUBLIC_CLIENT_CONFIGURATION', redactedSample: redact(value) }
    // Credential kind: a real-looking value present is a confirmed exposure; empty/placeholder is not.
    const real = value.length >= 12 && !/^(undefined|null|false|true)$/i.test(value) && !/your[_-]?key|placeholder|example|changeme|dummy|xxxx/i.test(value)
    if (real) return { name: spec.name, kind: spec.kind, exposure: 'CONFIRMED_SECRET_EXPOSED', redactedSample: redact(value) }
    return { name: spec.name, kind: spec.kind, exposure: 'NOT_PRESENT_IN_SHIPPED_BUNDLE' }
  })
}

/**
 * Redact a matched value to a NON-REVERSIBLE correlation fingerprint — never any secret
 * material (not even a prefix). Same secret → same fingerprint, so two deployments sharing a
 * leaked key can be correlated without exposing it. FNV-1a (no crypto import needed here).
 */
function redact(value: string): string {
  const v = value.replace(/^["']|["']$/g, '')
  let h = 0x811c9dc5
  for (let i = 0; i < v.length; i++) { h ^= v.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  const fp = (h >>> 0).toString(16).padStart(8, '0')
  return `fp:${fp} (${v.length} chars, redacted)`
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
