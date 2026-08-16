/*
 * CLIENT-SECRET-FALLBACK detector suite (Stage 3C). CF1–CF5.
 * Sensitivity: a client `import.meta.env.VITE_*_API_KEY` read is detected + tiered. Specificity:
 * a comment mention or a non-secret VITE_ (region/version) is not flagged. The suite tests the
 * DETECTOR on synthetic input (the real-source scan is a producer that records findings).
 */
import { describe, it, expect } from 'vitest'
import { scanClientSource, summarizeClientSecretReads } from './clientSecretFallback'

describe('client secret-fallback detector', () => {
  it('CF1 · detects a billable client read and tiers it BILLABLE', () => {
    const reads = scanClientSource('x.ts', 'const k = import.meta.env.VITE_OPENAI_API_KEY as string')
    expect(reads.length).toBe(1)
    expect(reads[0]!.tier).toBe('BILLABLE')
    expect(reads[0]!.envName).toBe('VITE_OPENAI_API_KEY')
  })
  it('CF2 · detects a free-tier client read (Gemini/Groq) and tiers it FREE_TIER', () => {
    const reads = scanClientSource('x.ts', 'const g = import.meta.env.VITE_GEMINI_API_KEY\nconst q = import.meta.env.VITE_GROQ_API_KEY')
    expect(reads.map((r) => r.tier).sort()).toEqual(['FREE_TIER', 'FREE_TIER'])
    expect(summarizeClientSecretReads(reads).freeTierCount).toBe(2)
  })
  it('CF3 · SPECIFICITY — a comment mention is not flagged', () => {
    expect(scanClientSource('x.ts', '// reads import.meta.env.VITE_GEMINI_API_KEY as a fallback').length).toBe(0)
    expect(scanClientSource('x.ts', '/* import.meta.env.VITE_OPENAI_API_KEY */').length).toBe(0)
  })
  it('CF4 · SPECIFICITY — a non-secret VITE_ (region/version) is not flagged', () => {
    expect(scanClientSource('x.ts', 'const r = import.meta.env.VITE_AZURE_TTS_REGION\nconst v = import.meta.env.VITE_APP_VERSION').length).toBe(0)
  })
  it('CF5 · summarize — clean when no reads; reports line numbers', () => {
    expect(summarizeClientSecretReads([]).clean).toBe(true)
    const reads = scanClientSource('a.ts', 'x\nx\nconst k = import.meta.env.VITE_GROQ_API_KEY')
    expect(reads[0]!.line).toBe(3)
    expect(summarizeClientSecretReads(reads).clean).toBe(false)
  })
})
