/*
 * BUNDLE SECRET SCAN regression (P0 incident: billable Azure key baked into deployed 0.286 bundle).
 * The observed leak shape (redacted here) is the canonical positive case; this proves the gate
 * that was missing would catch it. No real secret is stored in this test.
 */
import { describe, it, expect } from 'vitest'
import { scanBundleForBillableSecrets, classifyShippedKeys } from './bundleSecretScan'

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

describe('classifyShippedKeys — exposure classification (Stage 3C §2-3, §6 certification)', () => {
  const find = (rs: ReturnType<typeof classifyShippedKeys>, name: string) => rs.find((r) => r.name === name)!

  it('SENSITIVITY · a billable server-only key with a real value → CONFIRMED_SECRET_EXPOSED', () => {
    const b = 'VITE_OPENAI_API_KEY:"sk-proj-REDACTEDsynthetic0123456789abcdefghij"'
    expect(find(classifyShippedKeys(b), 'VITE_OPENAI_API_KEY').exposure).toBe('CONFIRMED_SECRET_EXPOSED')
  })

  it('SENSITIVITY · a free-tier client credential with a real value is still CONFIRMED_SECRET_EXPOSED (owner §2)', () => {
    const b = 'VITE_GEMINI_API_KEY:"AIzaSyREDACTEDsynthetic0123456789"'
    expect(find(classifyShippedKeys(b), 'VITE_GEMINI_API_KEY').exposure).toBe('CONFIRMED_SECRET_EXPOSED')
  })

  it('SPECIFICITY · a public region id shipping client-side → PUBLIC_CLIENT_CONFIGURATION, NOT a leak', () => {
    const b = 'VITE_AZURE_TTS_REGION:"eastus",VITE_APP_VERSION:"30.14.0"'
    expect(find(classifyShippedKeys(b), 'VITE_AZURE_TTS_REGION').exposure).toBe('PUBLIC_CLIENT_CONFIGURATION')
    expect(find(classifyShippedKeys(b), 'VITE_APP_VERSION').exposure).toBe('PUBLIC_CLIENT_CONFIGURATION')
  })

  it('SPECIFICITY · a credential key that is ABSENT → NOT_PRESENT (do not over-claim, owner §2)', () => {
    const b = 'VITE_APP_VERSION:"30.14.0"' // no Groq key present
    expect(find(classifyShippedKeys(b), 'VITE_GROQ_API_KEY').exposure).toBe('NOT_PRESENT_IN_SHIPPED_BUNDLE')
  })

  it('REDACTION · a confirmed exposure never echoes the secret and correlates by fingerprint', () => {
    const secret = 'sk-proj-REDACTEDsynthetic0123456789abcdefghij'
    const a = find(classifyShippedKeys(`VITE_OPENAI_API_KEY:"${secret}"`), 'VITE_OPENAI_API_KEY')
    const b = find(classifyShippedKeys(`X VITE_OPENAI_API_KEY="${secret}" Y`), 'VITE_OPENAI_API_KEY')
    expect(a.redactedSample).not.toContain(secret)
    expect(a.redactedSample).toMatch(/fp:[0-9a-f]{8}/)
    // Same secret → same fingerprint (correlation across deployments) regardless of surrounding form.
    expect(a.redactedSample).toBe(b.redactedSample)
  })
})
