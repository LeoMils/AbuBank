/*
 * CLIENT-SIDE SECRET-FALLBACK DETECTOR.  (Stage 3C — o-privacy family; P0 follow-up)
 * ════════════════════════════════════════════════════════════════════════════════════════
 * serverCredentialContract catches a server path reading a billable key via a VITE_ name. Its
 * mirror was missing: a CLIENT path reading a provider secret via `import.meta.env.VITE_*` — a
 * fallback that (a) forces the secret into the client bundle and (b) means the VITE_ var can
 * never be fully removed while that provider is wanted. The CODE-READY audit surfaced exactly
 * this: Gemini + Groq are client-side VITE_ fallbacks with no non-VITE server path.
 *
 * This is the detector; the producer (scripts/scan-client-secret-fallbacks.ts) runs it over the
 * real client source and records findings. It classifies by the shipped-key contract so a
 * free-tier provider is reported with its tier, not conflated with a billable leak.
 */

export type ProviderTier = 'BILLABLE' | 'FREE_TIER'

export interface ClientSecretRead {
  file: string
  line: number
  envName: string
  tier: ProviderTier
}

export interface ClientSecretScanResult {
  reads: ClientSecretRead[]
  billableCount: number
  freeTierCount: number
  /** True iff NO client path reads any provider secret via a VITE_ name. */
  clean: boolean
}

/** Provider secret env names read on the client, by tier. REGION/VERSION/etc. are not secrets. */
export const CLIENT_PROVIDER_SECRETS: Record<string, ProviderTier> = {
  VITE_OPENAI_API_KEY: 'BILLABLE',
  VITE_AZURE_TTS_KEY: 'BILLABLE',
  VITE_BRAVE_API_KEY: 'BILLABLE',
  VITE_EXA_API_KEY: 'BILLABLE',
  VITE_OPENROUTER_API_KEY: 'BILLABLE',
  VITE_PERPLEXITY_API_KEY: 'BILLABLE',
  VITE_TAVILY_API_KEY: 'BILLABLE',
  VITE_GEMINI_API_KEY: 'FREE_TIER',
  VITE_GROQ_API_KEY: 'FREE_TIER',
}

/** Strip line + block comments so a doc mention doesn't false-positive. Block comments are
 *  blanked in place (newlines preserved) so reported line numbers stay accurate. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n')
}

/**
 * Scan one client source file's text for `import.meta.env.VITE_*_API_KEY` provider-secret reads.
 * Returns each read with its tier. A file with no such read contributes nothing.
 */
export function scanClientSource(file: string, source: string): ClientSecretRead[] {
  const reads: ClientSecretRead[] = []
  const lines = stripComments(source).split('\n')
  for (let i = 0; i < lines.length; i++) {
    for (const [envName, tier] of Object.entries(CLIENT_PROVIDER_SECRETS)) {
      // Catch BOTH dot access (import.meta.env.VITE_X) AND bracket/cast access
      // ((import.meta as ...).env?.['VITE_X'] / import.meta.env['VITE_X']). The bracket+cast
      // form slipped past a dot-only detector (calendarTranscribe.ts Groq read) — fail closed.
      const dot = new RegExp(`import\\.meta\\.env\\.${envName}\\b`)
      const bracket = new RegExp(`\\.env\\s*\\??\\.?\\s*\\[\\s*['"]${envName}['"]`)
      if (dot.test(lines[i]!) || bracket.test(lines[i]!)) {
        reads.push({ file, line: i + 1, envName, tier })
      }
    }
  }
  return reads
}

/** Aggregate reads across files into a result. `clean` means zero client provider-secret reads. */
export function summarizeClientSecretReads(reads: ClientSecretRead[]): ClientSecretScanResult {
  const billableCount = reads.filter((r) => r.tier === 'BILLABLE').length
  const freeTierCount = reads.filter((r) => r.tier === 'FREE_TIER').length
  return { reads, billableCount, freeTierCount, clean: reads.length === 0 }
}
