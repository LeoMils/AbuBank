/*
 * Evolution OS — redaction, secret scanning, and PII minimization
 * ═══════════════════════════════════════════════════════════════
 * The privacy/security boundary EVERY piece of evidence crosses before it is
 * stored, queued, or ingested. Rules (Sections 6, 19, privacy-boundaries.md):
 *  - Raw audio is never collected.
 *  - Secrets/tokens/passwords/keys must NEVER enter the pipeline.
 *  - Phone numbers, emails, street addresses, full contact books are minimized.
 *  - Production content is UNTRUSTED DATA — it is redacted, never interpreted as
 *    instructions or code. (Inertness is structural: we only ever store strings;
 *    `assertInert` documents + tests that we never eval/Function them.)
 *
 * Pure functions only. Deterministic. No I/O.
 */

export type PiiClass =
  | 'phone' | 'email' | 'long_number' | 'israeli_id' | 'street_address' | 'url_with_query'

export interface RedactionResult {
  text: string
  piiClassesDetected: PiiClass[]
  secretsRemoved: number
}

// ── Secret patterns (removed entirely, replaced with a marker) ───────────────
// Deliberately broad: a false positive that strips a token is safe; a false
// negative that leaks one is not.
const SECRET_PATTERNS: Array<{ re: RegExp; name: string }> = [
  { re: /\bsk-[A-Za-z0-9]{16,}\b/g, name: 'openai_key' },
  { re: /\bgsk_[A-Za-z0-9]{16,}\b/g, name: 'groq_key' },
  { re: /\bAIza[0-9A-Za-z_\-]{20,}\b/g, name: 'google_key' },
  { re: /\bBearer\s+[A-Za-z0-9._\-]{12,}\b/gi, name: 'bearer' },
  { re: /\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{6,}\.[A-Za-z0-9_\-]{6,}\b/g, name: 'jwt' },
  { re: /\bxox[baprs]-[A-Za-z0-9\-]{10,}\b/g, name: 'slack_token' },
  { re: /\b(?:api[_-]?key|secret|password|token)\s*[:=]\s*["']?[A-Za-z0-9._\-]{8,}["']?/gi, name: 'kv_secret' },
]

// ── PII patterns (masked, not deleted — we keep the SHAPE for debugging) ─────
const PII_PATTERNS: Array<{ re: RegExp; cls: PiiClass; mask: string }> = [
  // Emails first (before phone) so the @ form isn't half-eaten by number rules.
  { re: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, cls: 'email', mask: '[email]' },
  // Israeli / international phone shapes (05x-xxxxxxx, +972…, grouped digits).
  { re: /(?:\+?972[-\s]?|0)(?:[23489]|5[0-9]|7[0-9])[-\s]?\d{3}[-\s]?\d{4}\b/g, cls: 'phone', mask: '[phone]' },
  // URLs carrying a query string can leak tokens/ids — strip the query.
  { re: /\bhttps?:\/\/[^\s]+\?[^\s]+/g, cls: 'url_with_query', mask: '[url]' },
  // Israeli ID (9 digits) and other long digit runs (>=7) — mask, keep length hint.
  { re: /\b\d{9}\b/g, cls: 'israeli_id', mask: '[id]' },
  { re: /\b\d{7,}\b/g, cls: 'long_number', mask: '[number]' },
]

/**
 * Redact a single free-text string. Order matters: secrets are removed first
 * (highest severity), then structured PII is masked. Returns the cleaned text
 * plus what was found (for the trace `privacy.piiClassesDetected`).
 */
export function redactText(input: string | undefined | null): RedactionResult {
  if (!input) return { text: '', piiClassesDetected: [], secretsRemoved: 0 }
  let text = input
  let secretsRemoved = 0
  for (const { re } of SECRET_PATTERNS) {
    text = text.replace(re, () => { secretsRemoved++; return '[secret-removed]' })
  }
  const detected = new Set<PiiClass>()
  for (const { re, cls, mask } of PII_PATTERNS) {
    if (re.test(text)) {
      detected.add(cls)
      text = text.replace(re, mask)
    }
    re.lastIndex = 0 // reset stateful global regex
  }
  return { text, piiClassesDetected: [...detected], secretsRemoved }
}

/**
 * Deep-redact an arbitrary JSON-serializable value (object graphs of trace data).
 * Strings are redacted; keys whose name signals a secret/credential are dropped
 * entirely; arrays/objects are walked. Cyclic/oversized graphs are bounded.
 */
const SECRET_KEY_RE = /\b(?:authorization|api[_-]?key|secret|password|passwd|token|cookie|set-cookie|credential)\b/i

export function redactDeep(value: unknown, _depth = 0): { value: unknown; pii: PiiClass[]; secretsRemoved: number } {
  const pii = new Set<PiiClass>()
  let secretsRemoved = 0
  const MAX_DEPTH = 8

  function walk(v: unknown, depth: number): unknown {
    if (depth > MAX_DEPTH) return '[max-depth]'
    if (typeof v === 'string') {
      const r = redactText(v)
      r.piiClassesDetected.forEach(c => pii.add(c))
      secretsRemoved += r.secretsRemoved
      return r.text
    }
    if (v === null || typeof v === 'number' || typeof v === 'boolean') return v
    if (Array.isArray(v)) return v.slice(0, 200).map(x => walk(x, depth + 1))
    if (typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (SECRET_KEY_RE.test(k)) { secretsRemoved++; out[k] = '[secret-removed]'; continue }
        out[k] = walk(val, depth + 1)
      }
      return out
    }
    // functions / symbols / undefined never belong in evidence.
    return undefined
  }

  const cleaned = walk(value, _depth)
  return { value: cleaned, pii: [...pii], secretsRemoved }
}

/**
 * Structural inertness guarantee. Production evidence is DATA. This helper exists
 * to make the guarantee explicit and testable: evidence is round-tripped through
 * JSON so no live object, function, or prototype escapes into the pipeline. If a
 * value cannot be represented as plain JSON data, it is rejected.
 */
export function assertInert<T>(value: T): T {
  const json = JSON.stringify(value)
  if (json === undefined) throw new Error('evolution: value is not inert JSON data')
  return JSON.parse(json) as T
}

/** Cheap heuristic: does this text look like it is TRYING to be an instruction/injection? */
export function looksLikeInjection(text: string): boolean {
  return /\b(ignore (?:all|previous) instructions|system prompt|run (?:this )?(?:command|shell)|<\/?system>|exec\(|rm -rf|DROP TABLE)\b/i.test(text)
}
