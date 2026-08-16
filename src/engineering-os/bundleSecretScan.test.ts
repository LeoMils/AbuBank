/*
 * BUNDLE SECRET SCAN regression (P0 incident: billable Azure key baked into deployed 0.286 bundle).
 * The observed leak shape (redacted here) is the canonical positive case; this proves the gate
 * that was missing would catch it. No real secret is stored in this test.
 */
import { describe, it, expect } from 'vitest'
import { scanBundleForBillableSecrets } from './bundleSecretScan'

describe('bundle secret scan — the missing gate (P0 regression)', () => {
  it('DETECTS the observed leak shape: VITE_AZURE_TTS_KEY inlined with a real value', () => {
    // Mirrors the deployed-bundle object-literal inline (synthetic value, NOT the real key).
    const bundle = 'APP_VERSION:"30.14.0",VITE_AZURE_TTS_KEY:"AbCdEf0123456789abcdef",MODE:"production"'
    const r = scanBundleForBillableSecrets(bundle)
    expect(r.clean).toBe(false)
    expect(r.findings.map((f) => f.key)).toContain('VITE_AZURE_TTS_KEY')
    // The finding must be redacted — never echo the full secret.
    expect(r.findings[0]!.redactedSample).not.toContain('456789abcdef')
    expect(r.findings[0]!.redactedSample).toMatch(/redacted/)
  })

  it('DETECTS an inlined billable OpenAI key (assignment form)', () => {
    const bundle = 'const cfg={VITE_OPENAI_API_KEY="sk-proj-abcdef0123456789"};'
    expect(scanBundleForBillableSecrets(bundle).clean).toBe(false)
  })

  it('SPECIFICITY · a clean bundle with no billable key value → clean', () => {
    const bundle = 'APP_VERSION:"30.14.0",VITE_GROQ_API_KEY:"gsk_freeTierAllowedClientSide",MODE:"production"'
    expect(scanBundleForBillableSecrets(bundle).clean).toBe(true)
  })

  it('SPECIFICITY · a key NAME with an empty/placeholder value does not false-positive', () => {
    expect(scanBundleForBillableSecrets('VITE_AZURE_TTS_KEY:""').clean).toBe(true)
    expect(scanBundleForBillableSecrets('VITE_AZURE_TTS_KEY:"undefined"').clean).toBe(true)
    expect(scanBundleForBillableSecrets('VITE_AZURE_TTS_KEY:"your-key-here"').clean).toBe(true)
  })

  it('NON-VACUITY · the scanner is not always-dirty (clean input is clean)', () => {
    expect(scanBundleForBillableSecrets('no secrets here at all').clean).toBe(true)
  })
})
